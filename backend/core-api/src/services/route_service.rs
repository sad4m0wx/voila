use anyhow::{anyhow, Result};
use reqwest::Client;
use serde::Deserialize;
use serde_json::{Value, json};
use std::env;
use std::time::Duration;
use log::{error, info, debug};
use std::time::Instant;
use tokio::sync::Semaphore;
use once_cell::sync::Lazy;
use futures::future::join_all;
use polyline::decode_polyline;

use crate::models::Location;
use crate::models::transit::{TransitStep, TransitDetails, TransitLine, GeoJson};
use crate::services::cache_service::{CacheService, CACHE_TTL_SECONDS};

static REQUEST_SEMAPHORE: Lazy<Semaphore> = Lazy::new(|| Semaphore::new(30));

#[derive(Clone)]
pub struct RouteService {
    client: Client,
    valhalla_url: String,
}

impl RouteService {
    pub fn new() -> Self {
        let valhalla_url = env::var("VALHALLA_URL")
            .unwrap_or_else(|_| "http://voila-app.fr:8002".to_string());
            
        let client = Client::builder()
            .timeout(Duration::from_secs(120))
            .pool_max_idle_per_host(30) 
            .pool_idle_timeout(Duration::from_secs(120))
            .tcp_keepalive(Duration::from_secs(60))
            .build()
            .expect("Failed to create HTTP client");

        info!("Valhalla route service initialized with endpoint: {}", valhalla_url);

        Self { client, valhalla_url }
    }
    
    pub async fn get_transit_route(
        &self,
        from: &Location,
        to: &Location,
    ) -> Result<(Duration, f64, Vec<TransitStep>)> {
        let cache_service = CacheService::global().await;
        
        // Check for cached transit route with "valhalla" prefix to distinguish from GraphHopper cache
        if let Some(cached_result) = cache_service.get_cached_route(from, to, "valhalla_pt").await {
            info!("🎯 Valhalla transit route cache hit!");
            return Ok(cached_result);
        }
        
        let permit = REQUEST_SEMAPHORE.acquire().await.expect("Semaphore closed");
        let result = self.compute_valhalla_route(from, to).await;
        drop(permit);
        
        match &result {
            Ok(route_result) => {
                let _ = cache_service.cache_route(
                    from,
                    to,
                    "valhalla_pt",
                    route_result,
                    Some(CACHE_TTL_SECONDS)
                ).await;
            }
            Err(e) => {
                debug!("Valhalla route computation failed, not caching: {}", e);
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

        return join_all(futures).await;
        
    }

    async fn compute_valhalla_route(
        &self,
        from: &Location,
        to: &Location,
    ) -> Result<(Duration, f64, Vec<TransitStep>)> {
        info!("🔗 Calling Valhalla route API for {:.6}, {:.6} to {:.6}, {:.6}", 
              from.latitude, from.longitude, to.latitude, to.longitude);
            
        // Build Valhalla route request
        let route_request = self.build_route_request(from, to)?;
        
        let start_time = Instant::now();
        let response = self.client
            .post(&format!("{}/route", self.valhalla_url))
            .json(&route_request)
            .send()
            .await
            .map_err(|e| anyhow!("Failed to call Valhalla route API: {}", e))?;
        
        let elapsed_time = start_time.elapsed(); 
        info!("Valhalla route request took {:?}", elapsed_time);

        let status = response.status();
        let response_text = response.text().await
            .map_err(|e| anyhow!("Failed to read Valhalla response: {}", e))?;

        if !status.is_success() {
            error!("❌ Valhalla route API error {}: {}", status, response_text);
            return Err(anyhow!("Valhalla route API returned error {}: {}", status, response_text));
        }
        
        debug!("📨 Valhalla route response: {}", response_text);

        self.parse_route_response(&response_text)
    }

    fn build_route_request(&self, from: &Location, to: &Location) -> Result<Value> {
        const DEPARTURE_TIME: &str = "2025-05-01T12:00";

        let route_request = json!({
            "locations": [
                {
                    "lat": from.latitude,
                    "lon": from.longitude
                },
                {
                    "lat": to.latitude,
                    "lon": to.longitude
                }
            ],
            "costing": "multimodal",
            "costing_options": {
                "multimodal": {
                    "transit_cost": 1.0,
                    "walking_speed": 5.1,
                    "max_walking_distance": 2000
                }
            },
            "date_time": {
                "type": 1, // Depart at
                "value": DEPARTURE_TIME
            },
            "shape_match": "edge_walk",
            "filters": {
                "attributes": ["edge.length", "edge.time", "edge.id"],
                "action": "include"
            }
        });

        Ok(route_request)
    }

    fn parse_route_response(&self, response_text: &str) -> Result<(Duration, f64, Vec<TransitStep>)> {
        let response_data: ValhallaRouteResponse = serde_json::from_str(response_text)
            .map_err(|e| anyhow!("Failed to parse Valhalla route response: {}", e))?;

        if response_data.trip.legs.is_empty() {
            return Err(anyhow!("No route legs found"));
        }

        // Valhalla multimodal returns a single leg with maneuvers
        let leg = &response_data.trip.legs[0];
        let total_time = leg.summary.time;
        let total_distance = leg.summary.length;
        
        // Decode the entire route geometry
        let all_coordinates = self.decode_shape_to_geojson(&leg.shape)
            .unwrap_or_else(|e| {
                debug!("Failed to decode shape geometry: {}", e);
                Vec::new()
            });
        
        let mut steps = Vec::new();
        let mut current_walking_distance = 0.0;
        let mut current_walking_time = 0.0;
        let mut current_walking_instructions = Vec::new();
        let mut current_walking_start_index: Option<usize> = None;

        for maneuver in &leg.maneuvers {
            match maneuver.travel_mode.as_str() {
                "transit" => {
                    // First, add any accumulated walking steps as a single walking segment
                    if current_walking_time > 0.0 {
                        let walking_geometry = if let Some(start_idx) = current_walking_start_index {
                            // Use the previous maneuver's end index as the end of walking segment
                            if let Some(prev_maneuver) = leg.maneuvers.iter().rev()
                                .find(|m| m.travel_mode == "pedestrian") {
                                self.extract_geometry_segment(&all_coordinates, start_idx, prev_maneuver.end_shape_index)
                            } else {
                                None
                            }
                        } else {
                            None
                        };

                        steps.push(TransitStep {
                            distance: current_walking_distance,
                            duration: current_walking_time as u32,
                            mode: "walking".to_string(),
                            instructions: Some(format!("Walk for {:.0} meters", current_walking_distance * 1000.0)),
                            transit_details: None,
                            geometry: walking_geometry,
                        });
                        
                        current_walking_distance = 0.0;
                        current_walking_time = 0.0;
                        current_walking_instructions.clear();
                        current_walking_start_index = None;
                    }

                    // Add transit step
                    if let Some(transit_info) = &maneuver.transit_info {
                        let line_name = transit_info.short_name.clone();
                        let vehicle_type = match maneuver.travel_type.as_deref() {
                            Some("metro") => "subway",
                            Some("tram") => "tram", 
                            Some("rail") => "rail",
                            Some("bus") => "bus",
                            _ => "transit"
                        };

                        let departure_stop = transit_info.transit_stops.first()
                            .map(|s| s.name.clone())
                            .unwrap_or_default();
                        let arrival_stop = transit_info.transit_stops.last()
                            .map(|s| s.name.clone())
                            .unwrap_or_default();

                        let instruction = format!("Take {} {} from {} to {}", 
                            vehicle_type, line_name, departure_stop, arrival_stop);

                        let transit_geometry = self.extract_geometry_segment(
                            &all_coordinates,
                            maneuver.begin_shape_index,
                            maneuver.end_shape_index
                        );

                        steps.push(TransitStep {
                            distance: maneuver.length,
                            duration: maneuver.time as u32,
                            mode: "transit".to_string(),
                            instructions: Some(instruction),
                            geometry: transit_geometry,
                            transit_details: Some(TransitDetails {
                                line: TransitLine {
                                    name: transit_info.long_name.clone(),
                                    short_name: Some(line_name),
                                    color: format!("#{:06x}", transit_info.color),
                                    vehicle_type: vehicle_type.to_string(),
                                },
                                departure_stop,
                                arrival_stop,
                                departure_time: transit_info.transit_stops.first()
                                    .and_then(|s| s.departure_date_time.clone()),
                                arrival_time: transit_info.transit_stops.last()
                                    .and_then(|s| s.arrival_date_time.clone()),
                                num_stops: transit_info.transit_stops.len() as u32,
                            }),
                        });
                    }
                },
                "pedestrian" => {
                    // Track the start of walking segments for geometry extraction
                    if current_walking_start_index.is_none() {
                        current_walking_start_index = Some(maneuver.begin_shape_index);
                    }
                    
                    // Accumulate walking maneuvers
                    current_walking_distance += maneuver.length;
                    current_walking_time += maneuver.time;
                    current_walking_instructions.push(maneuver.instruction.clone());
                },
                _ => {
                    // Handle other modes
                    let other_geometry = self.extract_geometry_segment(
                        &all_coordinates,
                        maneuver.begin_shape_index,
                        maneuver.end_shape_index
                    );

                    steps.push(TransitStep {
                        distance: maneuver.length,
                        duration: maneuver.time as u32,
                        mode: maneuver.travel_mode.clone(),
                        instructions: Some(maneuver.instruction.clone()),
                        transit_details: None,
                        geometry: other_geometry,
                    });
                }
            }
        }

        // Add any remaining walking steps
        if current_walking_time > 0.0 {
            let final_walking_geometry = if let Some(start_idx) = current_walking_start_index {
                // Use the last maneuver's end index as the end of final walking segment
                if let Some(last_maneuver) = leg.maneuvers.iter().rev()
                    .find(|m| m.travel_mode == "pedestrian") {
                    self.extract_geometry_segment(&all_coordinates, start_idx, last_maneuver.end_shape_index)
                } else {
                    None
                }
            } else {
                None
            };

            steps.push(TransitStep {
                distance: current_walking_distance,
                duration: current_walking_time as u32,
                mode: "walking".to_string(),
                instructions: Some(format!("Walk for {:.0} meters", current_walking_distance * 1000.0)),
                transit_details: None,
                geometry: final_walking_geometry,
            });
        }

        let duration = Duration::from_secs(total_time as u64);
        
        Ok((duration, total_distance, steps))
    }

    fn decode_shape_to_geojson(&self, encoded_shape: &str) -> Result<Vec<Vec<f64>>> {
        let coordinates = decode_polyline(encoded_shape, 6)
            .map_err(|e| anyhow!("Failed to decode polyline: {}", e))?
            .into_iter()
            .map(|coord| vec![coord.x, coord.y]) // [longitude, latitude] for GeoJSON
            .collect();
        
        Ok(coordinates)
    }

    fn extract_geometry_segment(
        &self,
        all_coordinates: &[Vec<f64>],
        begin_index: usize,
        end_index: usize,
    ) -> Option<GeoJson> {
        if begin_index >= all_coordinates.len() || end_index >= all_coordinates.len() || begin_index > end_index {
            return None;
        }

        let segment_coords = all_coordinates[begin_index..=end_index].to_vec();
        
        if segment_coords.len() < 2 {
            return None;
        }

        Some(GeoJson {
            geo_type: "LineString".to_string(),
            coordinates: segment_coords,
        })
    }
}

// Valhalla response structures
#[derive(Debug, Deserialize)]
struct ValhallaRouteResponse {
    trip: ValhallaTrip,
}

#[derive(Debug, Deserialize)]
struct ValhallaTrip {
    legs: Vec<ValhallaLeg>,
}

#[derive(Debug, Deserialize)]
struct ValhallaLeg {
    maneuvers: Vec<ValhallaManeuver>,
    summary: ValhallaSummary,
    shape: String,
}

#[derive(Debug, Deserialize, Clone)]
struct ValhallaManeuver {
    #[serde(rename = "type")]
    maneuver_type: u8,
    instruction: String,
    time: f64,
    length: f64,
    travel_mode: String,
    travel_type: Option<String>,
    transit_info: Option<ValhallaTransitInfo>,
    begin_shape_index: usize,
    end_shape_index: usize,
}

#[derive(Debug, Deserialize)]
struct ValhallaSummary {
    time: f64,
    length: f64,
}

#[derive(Debug, Deserialize, Clone)]
struct ValhallaTransitInfo {
    short_name: String,
    long_name: String,
    headsign: String,
    color: u32,
    transit_stops: Vec<ValhallaTransitStop>,
}

#[derive(Debug, Deserialize, Clone)]
struct ValhallaTransitStop {
    name: String,
    departure_date_time: Option<String>,
    arrival_date_time: Option<String>,
}
