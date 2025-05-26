// LEGACY ALGORITHM. UNUSED

use crate::models::location::{AddressInput, Location, MeetingPoint, TravelTime, LineString, Route};
use crate::services::graphhopper_client::GraphHopperClient;
use geo::algorithm::centroid::Centroid;
use geo_types::{MultiPoint, Point};
use log::{info, warn};
use std::time::Duration;
use futures::future::{join_all};
use std::sync::Arc;
use tokio::time::timeout;

const GRAPHHOPPER_TIMEOUT: Duration = Duration::from_secs(30); // Max 5s per route

pub struct MeetingPointFinder;

impl MeetingPointFinder {
    pub async fn find_optimal_meeting_point(
        addresses: &[AddressInput],
    ) -> anyhow::Result<(MeetingPoint, Vec<Route>)> {
        // Validate input
        if addresses.len() < 2 {
            return Err(anyhow::anyhow!("At least two addresses are required"));
        }

        // Convert addresses to locations
        let locations: Vec<(String, Location)> = addresses
            .iter()
            .filter_map(|addr| {
                addr.coordinates.map(|coords| {
                    (
                        addr.id.clone(),
                        Location::new(coords.1, coords.0)
                            .with_address(addr.address.clone().unwrap_or_default()),
                    )
                })
            })
            .collect();

        if locations.len() < 2 {
            return Err(anyhow::anyhow!("At least two valid locations are required"));
        }

        // Simple approach: just 3 candidates maximum
        let candidates = Self::generate_minimal_candidates(&locations);
        let graphhopper = Arc::new(GraphHopperClient::new());

        info!("Evaluating {} candidates for {} addresses", candidates.len(), locations.len());

        // Evaluate all candidates in parallel with timeout protection
        let candidate_futures: Vec<_> = candidates.into_iter().map(|candidate| {
            let locations = locations.clone();
            let graphhopper = Arc::clone(&graphhopper);
            
            async move {
                // Wrap the entire evaluation in a timeout
                match timeout(
                    Duration::from_secs(30), // Max 15s total per candidate
                    Self::evaluate_candidate_fast(candidate, locations, graphhopper)
                ).await {
                    Ok(result) => result,
                    Err(_) => {
                        warn!("Candidate evaluation timed out");
                        Err(anyhow::anyhow!("Evaluation timeout"))
                    }
                }
            }
        }).collect();

        let results = join_all(candidate_futures).await;
        
        // Find best result or use fallback
        let mut best_result = None;
        let mut best_score = f64::MAX;

        for result in results {
            if let Ok((meeting_point, routes, score)) = result {
                if score < best_score {
                    best_score = score;
                    best_result = Some((meeting_point, routes));
                }
            }
        }

        match best_result {
            Some((meeting_point, routes)) => Ok((meeting_point, routes)),
            None => {
                warn!("All candidates failed, using geometric fallback");
                Self::geometric_fallback(&locations)
            }
        }
    }

    fn generate_minimal_candidates(locations: &[(String, Location)]) -> Vec<Location> {
        // Just use 3 simple candidates
        let centroid = Self::geometric_centroid(locations);
        
        vec![
            centroid.clone(),
            // One point 500m north
            Location::new(centroid.latitude + 0.0045, centroid.longitude),
            // One point 500m east  
            Location::new(centroid.latitude, centroid.longitude + 0.0045),
        ]
    }

    fn geometric_centroid(locations: &[(String, Location)]) -> Location {
        let points: Vec<Point<f64>> = locations
            .iter()
            .map(|(_, loc)| loc.to_point())
            .collect();

        let multi_point = MultiPoint::new(points);
        let centroid_point = multi_point.centroid().unwrap();
        Location::new(centroid_point.y(), centroid_point.x())
    }

    async fn evaluate_candidate_fast(
        candidate: Location,
        locations: Vec<(String, Location)>,
        graphhopper: Arc<GraphHopperClient>,
    ) -> anyhow::Result<(MeetingPoint, Vec<Route>, f64)> {
        // Process ALL routes in parallel with individual timeouts
        let route_futures: Vec<_> = locations.into_iter().map(|(id, location)| {
            let candidate = candidate.clone();
            let graphhopper = Arc::clone(&graphhopper);
            
            async move {
                // Individual timeout per route
                let route_result = timeout(
                    GRAPHHOPPER_TIMEOUT,
                    graphhopper.get_transit_route(&location, &candidate)
                ).await;

                match route_result {
                    Ok(Ok((duration, distance, steps))) => {
                        // Success case
                        let duration_minutes = duration.as_secs() as f64 / 60.0;
                        
                        let transit_summary = Self::build_transit_summary(&steps);
                        
                        let travel_time = TravelTime {
                            id: id.clone(),
                            address: location.address.clone().unwrap_or_default(),
                            duration: duration_minutes.round() as u32,
                            distance,
                            estimated: false,
                            transit_summary: Some(transit_summary),
                        };

                        let route = Route {
                            id: id.clone(),
                            geometry: LineString::new(Self::simple_geometry(&steps, &location, &candidate)),
                            steps,
                        };
                        
                        (travel_time, route, duration_minutes, false)
                    }
                    _ => {
                        // Timeout or error - use geometric fallback
                        let distance = location.distance_to(&candidate);
                        let duration_minutes = distance / (5.0 * 1000.0 / 60.0); // 5 km/h walking
                        
                        let travel_time = TravelTime {
                            id: id.clone(),
                            address: location.address.clone().unwrap_or_default(),
                            duration: duration_minutes.round() as u32,
                            distance,
                            estimated: true,
                            transit_summary: Some("🚶 Walking (estimated)".to_string()),
                        };

                        let route = Route {
                            id: id.clone(),
                            geometry: LineString::new(vec![
                                (location.longitude, location.latitude),
                                (candidate.longitude, candidate.latitude),
                            ]),
                            steps: vec![],
                        };
                        
                        (travel_time, route, duration_minutes, true)
                    }
                }
            }
        }).collect();

        // Wait for all routes to complete
        let route_results = join_all(route_futures).await;
        
        let mut travel_times = Vec::new();
        let mut routes = Vec::new();
        let mut total_time = 0.0;
        let mut estimated_count = 0;

        for (travel_time, route, duration_minutes, is_estimated) in route_results {
            travel_times.push(travel_time);
            routes.push(route);
            total_time += duration_minutes;
            if is_estimated {
                estimated_count += 1;
            }
        }

        // Calculate score with penalty for estimates
        let avg_time = total_time / travel_times.len() as f64;
        let estimation_penalty = estimated_count as f64 * 10.0; // 10 min penalty per estimate
        let score = avg_time + estimation_penalty;

        let meeting_point = MeetingPoint {
            name: if estimated_count == 0 {
                "Optimal Transit Meeting Point".to_string()
            } else {
                format!("Meeting Point ({} estimated)", estimated_count)
            },
            coordinates: (candidate.longitude, candidate.latitude),
            travel_times,
        };

        Ok((meeting_point, routes, score))
    }

    fn build_transit_summary(steps: &[crate::models::transit::TransitStep]) -> String {
        let transit_steps: Vec<String> = steps
            .iter()
            .filter(|s| s.mode == "transit" && s.transit_details.is_some())
            .map(|s| {
                if let Some(details) = &s.transit_details {
                    format!("{} {}", 
                        Self::get_transit_icon(&details.line.vehicle_type),
                        details.line.short_name.as_deref().unwrap_or(&details.line.name)
                    )
                } else {
                    String::new()
                }
            })
            .filter(|s| !s.is_empty())
            .collect();

        if transit_steps.is_empty() {
            "🚶 Walking".to_string()
        } else {
            transit_steps.join(" → ")
        }
    }

    fn simple_geometry(
        steps: &[crate::models::transit::TransitStep],
        from: &Location,
        to: &Location,
    ) -> Vec<(f64, f64)> {
        // Simplified geometry extraction
        let mut coords = vec![(from.longitude, from.latitude)];
        
        // Just extract a few key points, don't be too detailed
        for step in steps.iter().take(5) { // Max 5 steps to keep it simple
            if let Some(geometry) = &step.geometry {
                if let Some(first_coord) = geometry.coordinates.first() {
                    coords.push((first_coord[0], first_coord[1]));
                }
                if let Some(last_coord) = geometry.coordinates.last() {
                    coords.push((last_coord[0], last_coord[1]));
                }
            }
        }
        
        coords.push((to.longitude, to.latitude));
        coords
    }

    fn geometric_fallback(locations: &[(String, Location)]) -> anyhow::Result<(MeetingPoint, Vec<Route>)> {
        let centroid = Self::geometric_centroid(locations);
        
        let travel_times: Vec<TravelTime> = locations.iter().map(|(id, location)| {
            let distance = location.distance_to(&centroid);
            let duration_minutes = distance / (5.0 * 1000.0 / 60.0); // 5 km/h walking
            
            TravelTime {
                id: id.clone(),
                address: location.address.clone().unwrap_or_default(),
                duration: duration_minutes.round() as u32,
                distance,
                estimated: true,
                transit_summary: Some("🚶 Walking (fallback)".to_string()),
            }
        }).collect();

        let routes: Vec<Route> = locations.iter().map(|(id, location)| {
            Route {
                id: id.clone(),
                geometry: LineString::new(vec![
                    (location.longitude, location.latitude),
                    (centroid.longitude, centroid.latitude),
                ]),
                steps: vec![],
            }
        }).collect();

        let meeting_point = MeetingPoint {
            name: "Geometric Center (Fallback)".to_string(),
            coordinates: (centroid.longitude, centroid.latitude),
            travel_times,
        };

        Ok((meeting_point, routes))
    }

    fn get_transit_icon(vehicle_type: &str) -> &'static str {
        match vehicle_type.to_lowercase().as_str() {
            "subway" | "metro" => "🚇",
            "bus" => "🚌", 
            "train" | "rail" => "🚆",
            "tram" | "light_rail" => "🚊",
            "ferry" => "⛴️",
            _ => "🚋",
        }
    }
}
