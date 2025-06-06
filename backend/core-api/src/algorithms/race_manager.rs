use crate::models::location::{AddressInput, MeetingPoint, Route};
// Fix imports to match your actual file names
use crate::algorithms::isochrone_algorithm::IsochroneAlgorithm;
use crate::algorithms::candidate_points_algorithm::CandidatePointsAlgorithm;
use log::{info, warn, error};
use std::time::{Duration, Instant};
use futures::future::{select, Either};
use tokio::task;
use tokio::time::timeout;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RaceResult {
    pub meeting_point: MeetingPoint,
    pub routes: Vec<Route>,
    pub algorithm_used: String,
    pub processing_time_ms: u64,
    pub background_started: bool,
}

pub struct RaceManager;

impl RaceManager {
    /// Find optimal meeting point by racing isochrone and classic algorithms
    pub async fn find_optimal_meeting_point(
        addresses: &[AddressInput],
        max_travel_time_minutes: Option<u32>,
        profile: Option<String>,
    ) -> anyhow::Result<RaceResult> {
        let start_time = Instant::now();
        
        info!("Starting race between isochrone and classic algorithms for {} addresses", addresses.len());

        // Validate input
        if addresses.len() < 2 {
            return Err(anyhow::anyhow!("At least two addresses are required"));
        }

        let addresses_clone1 = addresses.to_vec();
        let addresses_clone2 = addresses.to_vec();
        let max_time = max_travel_time_minutes;
        let profile_clone = profile.clone();

        // Start both algorithms simultaneously
        let isochrone_task = task::spawn(async move {
            info!("Starting isochrone algorithm");
            let result = IsochroneAlgorithm::find_meeting_point(
                &addresses_clone1,
                max_time,
                profile_clone,
            ).await;
            
            match &result {
                Ok(_) => info!("Isochrone algorithm completed successfully"),
                Err(e) => error!("Isochrone algorithm failed: {}", e),
            }
            
            result.map(|(mp, routes)| ("isochrone", mp, routes))
        });

        let classic_task = task::spawn(async move {
            info!("Starting classic algorithm");
            // Use the correct struct name
            let result = CandidatePointsAlgorithm::find_meeting_point(&addresses_clone2).await;
            
            match &result {
                Ok(_) => info!("Classic algorithm completed successfully"),
                Err(e) => error!("Classic algorithm failed: {}", e),
            }
            
            result.map(|(mp, routes)| ("classic", mp, routes))
        });

        // Race the algorithms with a reasonable timeout
        let race_timeout = Duration::from_secs(60);
        let race_result = timeout(race_timeout, async {
            match select(isochrone_task, classic_task).await {
                Either::Left((isochrone_result, classic_handle)) => {
                    // Isochrone finished first
                    match isochrone_result {
                        Ok(Ok((algorithm, meeting_point, routes))) => {
                            info!("Isochrone algorithm won the race");
                            
                            // Let classic algorithm finish in background (don't wait for it)
                            let background_started = Self::start_background_task(classic_handle, "classic");
                            
                            Ok((algorithm.to_string(), meeting_point, routes, background_started))
                        }
                        Ok(Err(e)) => {
                            warn!("Isochrone algorithm failed: {}, waiting for classic", e);
                            // Wait for classic algorithm
                            match classic_handle.await {
                                Ok(Ok((algorithm, meeting_point, routes))) => {
                                    info!("Classic algorithm succeeded as fallback");
                                    Ok((algorithm.to_string(), meeting_point, routes, false))
                                }
                                Ok(Err(e)) => Err(anyhow::anyhow!("Both algorithms failed. Classic error: {}", e)),
                                Err(e) => Err(anyhow::anyhow!("Classic algorithm task failed: {}", e)),
                            }
                        }
                        Err(e) => Err(anyhow::anyhow!("Isochrone algorithm task failed: {}", e)),
                    }
                }
                Either::Right((classic_result, isochrone_handle)) => {
                    // Classic finished first
                    match classic_result {
                        Ok(Ok((algorithm, meeting_point, routes))) => {
                            info!("Classic algorithm won the race");
                            
                            // Let isochrone algorithm finish in background for caching
                            let background_started = Self::start_background_task(isochrone_handle, "isochrone");
                            
                            Ok((algorithm.to_string(), meeting_point, routes, background_started))
                        }
                        Ok(Err(e)) => {
                            warn!("Classic algorithm failed: {}, waiting for isochrone", e);
                            // Wait for isochrone algorithm
                            match isochrone_handle.await {
                                Ok(Ok((algorithm, meeting_point, routes))) => {
                                    info!("Isochrone algorithm succeeded as fallback");
                                    Ok((algorithm.to_string(), meeting_point, routes, false))
                                }
                                Ok(Err(e)) => Err(anyhow::anyhow!("Both algorithms failed. Isochrone error: {}", e)),
                                Err(e) => Err(anyhow::anyhow!("Isochrone algorithm task failed: {}", e)),
                            }
                        }
                        Err(e) => Err(anyhow::anyhow!("Classic algorithm task failed: {}", e)),
                    }
                }
            }
        }).await;

        let processing_time = start_time.elapsed();

        match race_result {
            Ok(Ok((algorithm_used, meeting_point, routes, background_started))) => {
                info!("Race completed successfully with {} algorithm in {:?}", 
                      algorithm_used, processing_time);
                
                Ok(RaceResult {
                    meeting_point,
                    routes,
                    algorithm_used,
                    processing_time_ms: processing_time.as_millis() as u64,
                    background_started,
                })
            }
            Ok(Err(e)) => {
                error!("Both algorithms failed: {}", e);
                // Return geometric fallback
                Self::geometric_fallback(addresses, processing_time)
            }
            Err(_) => {
                error!("Race timed out after {:?}", race_timeout);
                // Return geometric fallback
                Self::geometric_fallback(addresses, processing_time)
            }
        }
    }

    /// Start background task that doesn't block the response
    fn start_background_task(
        task_handle: task::JoinHandle<Result<(&str, MeetingPoint, Vec<Route>), anyhow::Error>>,
        algorithm_name: &str,
    ) -> bool {
        let algorithm_name = algorithm_name.to_string();
        
        // Just drop the task handle - let it finish in the background
        // We don't need to wait for the result since it's just for caching
        std::mem::drop(task_handle);
        
        info!("Started background {} algorithm for caching", algorithm_name);
        true
    }

    /// Geometric fallback when both algorithms fail or timeout
    fn geometric_fallback(
        addresses: &[AddressInput],
        processing_time: Duration,
    ) -> anyhow::Result<RaceResult> {
        warn!("Using geometric fallback - both algorithms failed");

        use geo::algorithm::centroid::Centroid;
        use geo_types::{MultiPoint, Point};
        use crate::models::location::{Location, TravelTime, LineString};

        // Calculate geometric center
        let locations: Vec<Location> = addresses
            .iter()
            .filter_map(|addr| {
                addr.coordinates.map(|coords| Location::new(coords.1, coords.0))
            })
            .collect();

        if locations.is_empty() {
            return Err(anyhow::anyhow!("No valid locations found for fallback"));
        }

        let points: Vec<Point<f64>> = locations.iter().map(|loc| loc.to_point()).collect();
        let multi_point = MultiPoint::new(points);
        let centroid_point = multi_point.centroid().unwrap();
        let meeting_location = Location::new(centroid_point.y(), centroid_point.x());

        // Build travel times and routes
        let mut travel_times = Vec::new();
        let mut routes = Vec::new();

        for (i, (addr, location)) in addresses.iter().zip(locations.iter()).enumerate() {
            let id = format!("addr_{}", i);
            let distance = location.distance_to(&meeting_location);
            let duration_minutes = (distance / (5.0 * 1000.0 / 60.0)).round() as u32; // 5 km/h walking

            let travel_time = TravelTime {
                id: id.clone(),
                address: addr.address.clone().unwrap_or_default(),
                duration: duration_minutes,
                distance,
                estimated: true,
                transit_summary: Some("🚶 Walking (estimated)".to_string()),
            };

            let route = Route {
                id: id.clone(),
                geometry: LineString::new(vec![
                    (location.longitude, location.latitude),
                    (meeting_location.longitude, meeting_location.latitude),
                ]),
                steps: vec![],
            };

            travel_times.push(travel_time);
            routes.push(route);
        }

        let meeting_point = MeetingPoint {
            name: "Geometric Center (Fallback)".to_string(),
            coordinates: (meeting_location.longitude, meeting_location.latitude),
            travel_times,
        };

        Ok(RaceResult {
            meeting_point,
            routes,
            algorithm_used: "geometric_fallback".to_string(),
            processing_time_ms: processing_time.as_millis() as u64,
            background_started: false,
        })
    }
}

// Convenience function for other modules
pub async fn find_optimal_meeting_point(
    addresses: &[AddressInput],
    max_travel_time_minutes: Option<u32>,
    profile: Option<String>,
) -> anyhow::Result<RaceResult> {
    RaceManager::find_optimal_meeting_point(addresses, max_travel_time_minutes, profile).await
}