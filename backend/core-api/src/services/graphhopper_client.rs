use anyhow::{anyhow, Result};
use chrono::Utc;
use reqwest::Client;
use serde::Deserialize;
use std::env;
use std::time::Duration;
use log::{error, info, debug};
use std::time::Instant;
use tokio::sync::Semaphore;
use once_cell::sync::Lazy;
use futures::future::join_all;
use tokio::time::timeout;

use crate::models::Location;
use crate::models::transit::{TransitStep, GeoJson, TransitDetails, TransitLine};
use crate::services::cache_service::cache;

// Limit concurrent requests to prevent overwhelming GraphHopper
static REQUEST_SEMAPHORE: Lazy<Semaphore> = Lazy::new(|| Semaphore::new(30));

#[derive(Clone)]
pub struct GraphHopperClient {
    client: Client,
    base_url: String,
}

impl GraphHopperClient {
    pub fn new() -> Self {
        let base_url = env::var("GRAPHHOPPER_URL")
            .unwrap_or_else(|_| "http://voila-app.fr:8989".to_string());
            
        let client = Client::builder()
            .timeout(Duration::from_secs(120))
            .pool_max_idle_per_host(30) 
            .pool_idle_timeout(Duration::from_secs(120))
            .tcp_keepalive(Duration::from_secs(60))
            .build()
            .expect("Failed to create HTTP client");

        Self { client, base_url }
    }
    
    /// Get transit route with caching handled by global cache service
    pub async fn get_transit_route(
        &self,
        from: &Location,
        to: &Location,
    ) -> Result<(Duration, f64, Vec<TransitStep>)> {
        let cache_service = cache().await;
        
        // Check cache first (handled by global cache service with spatial tolerance)
        if let Some(cached_route) = cache_service.get_nearby_route(
            from, 
            to, 
            "pt", 
            200.0 // 200m spatial tolerance
        ).await {
            info!("Cache hit for transit route");
            // Extract duration and distance from cached route
            let duration_secs = if !cached_route.steps.is_empty() {
                cached_route.steps.iter().map(|step| step.duration).sum::<u32>() as u64
            } else {
                // Estimate based on distance
                let distance = from.distance_to(to);
                (distance / (20.0 * 1000.0 / 3600.0)) as u64 // 20 km/h average
            };
            
            let distance = if !cached_route.steps.is_empty() {
                cached_route.steps.iter().map(|step| step.distance).sum()
            } else {
                from.distance_to(to)
            };
            
            return Ok((Duration::from_secs(duration_secs), distance, cached_route.steps));
        }
        
        
        let permit = REQUEST_SEMAPHORE.acquire().await.expect("Semaphore closed");
        let result = self.compute_transit_route_uncached(from, to).await;
        drop(permit);
        
        match &result {
            Ok((_duration, _distance, steps)) => {
                // Cache the successful result using global cache service
                let route_to_cache = Route {
                    id: "cache".to_string(),
                    geometry: LineString::new(
                        Self::extract_geometry_from_steps(steps, from, to)
                    ),
                    steps: steps.clone(),
                };
                
                let _ = cache_service.cache_route(
                    from,
                    to,
                    "pt",
                    &route_to_cache,
                    CACHE_TTL_SECONDS
                ).await;
            
            }
            Err(e) => {
                debug!("Route computation failed, not caching: {}", e);
            }
        }
        
        result
    }

    /// Batch process multiple route requests in parallel
    pub async fn batch_route_requests(
        &self,
        origins: &[(String, Location)],
        destination: &Location,
    ) -> Vec<f64> {
        let timeout_duration = Duration::from_secs(30*origins.len() as u64);
        
        let route_futures: Vec<_> = origins.iter().map(|(_id, origin)| {
            let destination = destination.clone();
            let origin = origin.clone();
            
            async move {
                match timeout(timeout_duration, self.get_transit_route(&origin, &destination)).await {
                    Ok(Ok((duration, _, _))) => duration.as_secs_f64(),
                    _ => {
                        // Fallback: realistic urban transit speed (15 km/h)
                        let distance_km = origin.distance_to(&destination) / 1000.0;
                        distance_km * 240.0 // 15 km/h = 240 seconds per km
                    }
                }
            }
        }).collect();

        join_all(route_futures).await
    }


    /// Batch evaluate ALL candidates against all origins in one parallel operation
    pub async fn batch_evaluate_all_candidates(
        &self,
        origins: &[(String, Location)],
        candidates: &[Location],
    ) -> Vec<(Vec<f64>, Vec<Route>)> {
        let timeout_duration = Duration::from_secs(30);
        
        // Create futures for all candidate-origin combinations
        let all_route_futures: Vec<_> = candidates.iter().enumerate().map(|(candidate_idx, candidate)| {
            let candidate = candidate.clone();
            
            // For this candidate, create futures for all origins
            let candidate_route_futures: Vec<_> = origins.iter().map(|(id, origin)| {
                let candidate = candidate.clone();
                let origin = origin.clone();
                let id = id.clone();
                
                async move {
                    match timeout(timeout_duration, self.get_transit_route(&origin, &candidate)).await {
                        Ok(Ok((duration, _, steps))) => {
                            let geometry = Self::extract_geometry_from_steps(&steps, &origin, &candidate);
                            let route = Route {
                                id: id.clone(),
                                geometry: LineString::new(geometry),
                                steps,
                            };
                            (duration.as_secs_f64(), route)
                        }
                        _ => {
                            // Fallback route with realistic estimation
                            let distance_km = origin.distance_to(&candidate) / 1000.0;
                            let estimated_time = distance_km * 240.0; // 15 km/h
                            let route = Route {
                                id: id.clone(),
                                geometry: LineString::new(vec![
                                    (origin.longitude, origin.latitude),
                                    (candidate.longitude, candidate.latitude),
                                ]),
                                steps: vec![],
                            };
                            (estimated_time, route)
                        }
                    }
                }
            }).collect();
            
            // Return the candidate index and its route futures
            async move {
                let results = join_all(candidate_route_futures).await;
                let travel_times: Vec<f64> = results.iter().map(|(time, _)| *time).collect();
                let routes: Vec<_> = results.into_iter().map(|(_, route)| route).collect();
                (candidate_idx, travel_times, routes)
            }
        }).collect();

        // Execute all futures in parallel
        let all_results = join_all(all_route_futures).await;
        
        // Sort results by candidate index and return in order
        let mut sorted_results: Vec<_> = all_results.into_iter().collect();
        sorted_results.sort_by_key(|(candidate_idx, _, _)| *candidate_idx);
        
        sorted_results.into_iter().map(|(_, travel_times, routes)| (travel_times, routes)).collect()
    }

    /// Compute transit route without caching
    async fn compute_transit_route_uncached(
        &self,
        from: &Location,
        to: &Location,
    ) -> Result<(Duration, f64, Vec<TransitStep>)> {
        let today = Utc::now().date_naive();
        let departure_time = today
            .and_hms_opt(12, 0, 0)
            .unwrap()
            .and_utc()
            .to_rfc3339();
            
        let params = [
            ("point", format!("{},{}", from.latitude, from.longitude)),
            ("point", format!("{},{}", to.latitude, to.longitude)),
            ("pt.earliest_departure_time", departure_time),
            ("profile", "pt".to_string()),
            ("locale", "en".to_string()),
            ("details", "street_name".to_string()),
        ];

        let url = format!("{}/route", self.base_url);

        let start_time = Instant::now();
        let response = self.client
            .get(&url)
            .query(&params)
            .send()
            .await?;
        
        let elapsed_time = start_time.elapsed(); 
        info!("GraphHopper request took {:?}", elapsed_time);

        let response_text = response.text().await?;
        self.parse_route_response(&response_text)
    }

    /// Parse GraphHopper route response
    fn parse_route_response(&self, response_text: &str) -> Result<(Duration, f64, Vec<TransitStep>)> {
        match serde_json::from_str::<PtRouteResponse>(&response_text) {
            Ok(response_data) => {
                if response_data.paths.is_empty() {
                    return Err(anyhow!("No route found"));
                }
                
                let path = &response_data.paths[0];
                let duration = Duration::from_millis(path.time as u64);
                let distance = path.distance;
                
                let steps = self.convert_pt_legs_to_steps(&path.legs)?;
                
                Ok((duration, distance, steps))
            }
            Err(e) => {
                error!("Failed to parse GraphHopper response: {}", e);
                Err(anyhow!("Failed to parse GraphHopper response: {}", e))
            }
        }
    }

    /// Convert GraphHopper legs to transit steps
    fn convert_pt_legs_to_steps(&self, legs: &[PtLeg]) -> Result<Vec<TransitStep>> {
        let mut steps = Vec::new();
        
        for leg in legs {
            let step = match leg.leg_type.as_str() {
                "pt" => {
                    // Extract route information
                    let route_id = leg.route_id.clone().unwrap_or_default();
                    let trip_headsign = leg.trip_headsign.clone().unwrap_or_default();
                    
                    // Determine vehicle type from route_id
                    let vehicle_type = if route_id.contains("M") || trip_headsign.contains("Métro") {
                        "subway"
                    } else if route_id.contains("T") {
                        "tram"
                    } else if route_id.contains("RER") {
                        "rail"
                    } else {
                        "bus"
                    };
                    
                    // Extract line name
                    let line_name = route_id.trim_start_matches("PT:").to_string();
                    
                    // Build instruction text
                    let instruction = if let Some(stops) = &leg.stops {
                        let from_stop = stops.first().map(|s| s.stop_name.as_str()).unwrap_or("Unknown");
                        let to_stop = stops.last().map(|s| s.stop_name.as_str()).unwrap_or("Unknown");
                        format!("Take {} {} from {} to {}", vehicle_type, line_name, from_stop, to_stop)
                    } else {
                        format!("Take {}", trip_headsign)
                    };
                    
                    TransitStep {
                        distance: leg.distance,
                        duration: leg.travel_time.unwrap_or(0) as u32 / 1000, // Convert ms to seconds
                        mode: "transit".to_string(),
                        instructions: Some(instruction),
                        transit_details: Some(TransitDetails {
                            line: TransitLine {
                                name: trip_headsign,
                                short_name: Some(line_name),
                                color: "#1a73e8".to_string(), // Default color
                                vehicle_type: vehicle_type.to_string(),
                            },
                            departure_stop: leg.stops.as_ref()
                                .and_then(|s| s.first())
                                .map(|s| s.stop_name.clone())
                                .unwrap_or_default(),
                            arrival_stop: leg.stops.as_ref()
                                .and_then(|s| s.last())
                                .map(|s| s.stop_name.clone())
                                .unwrap_or_default(),
                            departure_time: Some(leg.departure_time.clone()),
                            arrival_time: Some(leg.arrival_time.clone()),
                            num_stops: leg.stops.as_ref().map(|s| s.len() as u32).unwrap_or(0),
                        }),
                        geometry: Some(leg.geometry.clone())
                    }
                },
                "walk" => {
                    let instruction = leg.instructions.as_ref()
                        .and_then(|instructions| instructions.first())
                        .map(|inst| inst.text.clone())
                        .unwrap_or_else(|| format!("Walk for {:.1} meters", leg.distance));
                    
                    TransitStep {
                        distance: leg.distance,
                        duration: leg.instructions.as_ref()
                            .and_then(|instructions| instructions.iter().map(|i| i.time).sum::<i64>().checked_div(1000))
                            .unwrap_or(0) as u32, // Convert ms to seconds
                        mode: "walking".to_string(),
                        instructions: Some(instruction),
                        transit_details: None,
                        geometry: Some(leg.geometry.clone())
                    }
                },
                _ => {
                    TransitStep {
                        distance: leg.distance,
                        duration: 0,
                        mode: leg.leg_type.clone(),
                        instructions: Some(format!("{} for {:.1} meters", leg.leg_type, leg.distance)),
                        transit_details: None,
                        geometry: Some(leg.geometry.clone()),
                    }
                }
            };
            
            steps.push(step);
        }
        
        Ok(steps)
    }

    /// Extract geometry coordinates from transit steps
    pub fn extract_geometry_from_steps(
        steps: &[TransitStep],
        from: &Location,
        to: &Location,
    ) -> Vec<(f64, f64)> {
        if steps.is_empty() {
            return vec![
                (from.longitude, from.latitude),
                (to.longitude, to.latitude),
            ];
        }

        let mut geometry = vec![(from.longitude, from.latitude)];
        
        // Extract coordinates from step geometry if available
        for step in steps {
            if let Some(ref geom) = step.geometry {
                for coord_pair in &geom.coordinates {
                    if coord_pair.len() >= 2 {
                        geometry.push((coord_pair[0], coord_pair[1]));
                    }
                }
            }
        }
        
        geometry.push((to.longitude, to.latitude));
        geometry
    }
}

// GraphHopper API response structures
#[derive(Debug, Deserialize)]
struct PtRouteResponse {
    paths: Vec<PtPath>,
}

#[derive(Debug, Deserialize)]
struct PtPath {
    distance: f64,
    time: i64,
    legs: Vec<PtLeg>,
}

#[derive(Debug, Deserialize)]
struct PtLeg {
    #[serde(rename = "type")]
    leg_type: String,
    geometry: GeoJson,
    distance: f64,
    instructions: Option<Vec<Instruction>>,
    departure_time: String,
    arrival_time: String,
    trip_headsign: Option<String>,
    travel_time: Option<i64>,
    stops: Option<Vec<PtStop>>,
    route_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Instruction {
    text: String,
    time: i64,
}

#[derive(Debug, Deserialize)]
struct PtStop {
    stop_name: String,
}