use anyhow::{anyhow, Result};
use reqwest::Client;
use serde::Deserialize;
use std::env;
use std::time::Duration;
use log::{error, info, debug};
use std::time::Instant;
use tokio::sync::Semaphore;
use once_cell::sync::Lazy;
use futures::future::join_all;


use crate::models::Location;
use crate::models::transit::{TransitStep, GeoJson, TransitDetails, TransitLine};
use crate::services::cache_service::{CacheService, CACHE_TTL_SECONDS};

static REQUEST_SEMAPHORE: Lazy<Semaphore> = Lazy::new(|| Semaphore::new(30));

#[derive(Clone)]
pub struct RouteService {
    client: Client,
    base_url: String,
}

impl RouteService {
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
    
    pub async fn get_transit_route(
        &self,
        from: &Location,
        to: &Location,
    ) -> Result<(Duration, f64, Vec<TransitStep>)> {
        let cache_service = CacheService::global().await;
        
        // Check for cached transit route
        if let Some(cached_result) = cache_service.get_cached_route(from, to, "pt").await {
            info!("🎯 Transit route cache hit!");
            return Ok(cached_result);
        }
        
        let permit = REQUEST_SEMAPHORE.acquire().await.expect("Semaphore closed");
        let result = self.compute_transit_route(from, to).await;
        drop(permit);
        
        match &result {
            Ok(route_result) => {
                let _ = cache_service.cache_route(
                    from,
                    to,
                    "pt",
                    route_result,
                    Some(CACHE_TTL_SECONDS)
                ).await;
                info!("💾 Transit route cached successfully");
            }
            Err(e) => {
                debug!("Route computation failed, not caching: {}", e);
            }
        }

        result
    }

    pub async fn get_transit_routes(
        &self,
        origins: &[(String, Location)],
        destination: &Location,
    ) -> Vec<Result<(Duration, f64, Vec<TransitStep>)>> {

        let futures: Vec<_> = origins.iter().map(|(_, origin)| {
            self.get_transit_route(&origin, &destination)
        }).collect();

        join_all(futures).await 
    }

    async fn compute_transit_route(
        &self,
        from: &Location,
        to: &Location,
    ) -> Result<(Duration, f64, Vec<TransitStep>)> {
        let departure_time = chrono::Utc::now()
            .date_naive()
            .and_hms_opt(12, 0, 0)
            .unwrap()
            .and_utc()
            .format("%Y-%m-%dT%H:%M:%SZ")
            .to_string();
            
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
}


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