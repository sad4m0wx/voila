// src/services/graphhopper_client.rs

use anyhow::{anyhow, Result};
use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::env;
use std::time::Duration;
use log::{error,info};
use std::time::Instant;

use crate::models::location::Location;
use crate::models::transit::{TransitDetails, TransitLine, TransitStep, GeoJson};

#[derive(Debug, Serialize)]
struct GraphHopperRequest {
    points: Vec<Vec<f64>>,          // [[lon1,lat1], [lon2,lat2], ...]
    point_hints: Vec<String>,       // Optional hints
    snap_preventions: Vec<String>,  // E.g., ["motorway"]
    details: Vec<String>,           // Additional details to return
    profile: String,                // "pt" for public transport
    locale: String,                 // "en"
    pt: PtSettings,
}

#[derive(Debug, Serialize)]
struct PtSettings {
    earliest_departure_time: i64,  // Unix timestamp
    profile_duration: bool,
    ignore_transfers: bool,
    walk_speed: f64,               // In km/h
}

#[derive(Debug, Deserialize)]
struct GraphHopperResponse {
    paths: Vec<Path>,
}


#[derive(Debug, Deserialize)]
struct PtRouteResponse {
    hints: Option<Value>,
    info: Option<Value>,
    paths: Vec<PtPath>,
}

#[derive(Debug, Deserialize)]
struct PtPath {
    distance: f64,
    weight: f64,
    time: i64,
    transfers: i32,
    points_encoded: bool,
    bbox: Vec<f64>,
    points: GeoJson,
    instructions: Vec<Instruction>,
    legs: Vec<PtLeg>,
    details: Option<Value>,
    ascend: Option<f64>,
    descend: Option<f64>,
    snapped_waypoints: Option<GeoJson>,
}



#[derive(Debug, Deserialize)]
struct Instruction {
    distance: f64,
    heading: Option<f64>,
    sign: i32,
    interval: Vec<i32>,
    text: String,
    time: i64,
    street_name: Option<String>,  
    last_heading: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct PtLeg {
    #[serde(rename = "type")]
    leg_type: String,  // "walk" or "pt"
    departure_location: String,
    geometry: GeoJson,
    distance: f64,
    instructions: Option<Vec<Instruction>>,
    details: Option<Value>,
    departure_time: String,
    arrival_time: String,
    
    // PT-specific fields
    feed_id: Option<String>,
    is_in_same_vehicle_as_previous: Option<bool>,
    trip_headsign: Option<String>,
    travel_time: Option<i64>,
    stops: Option<Vec<PtStop>>,
    trip_id: Option<String>,
    route_id: Option<String>,
}


#[derive(Debug, Deserialize)]
struct PtStop {
    stop_id: String,
    stop_name: String,
    geometry: StopGeometry,
    arrival_cancelled: Option<bool>,
    departure_time: Option<String>,
    planned_departure_time: Option<String>,
    departure_cancelled: Option<bool>,
    arrival_time: Option<String>,
    planned_arrival_time: Option<String>,
}

#[derive(Debug, Deserialize)]
struct StopGeometry {
    #[serde(rename = "type")]
    geo_type: String,
    coordinates: Vec<f64>,
}

#[derive(Debug, Deserialize)]
struct Path {
    weight: f64,
    distance: f64,
    time: i64,
    legs: Vec<Leg>,
    instructions: Vec<Instruction>,
}

#[derive(Debug, Deserialize)]
struct Leg {
    #[serde(rename = "type")]
    leg_type: String,  // "walk" or "pt"
    distance: f64,
    time: i64,         // Duration in milliseconds
    departure_time: Option<i64>,
    arrival_time: Option<i64>,
    
    // For PT legs
    trip_id: Option<String>,
    route_id: Option<String>,
    route_type: Option<i32>,  // 0=Tram, 1=Subway, 2=Rail, 3=Bus, ...
    route_short_name: Option<String>,
    route_name: Option<String>,
    route_color: Option<String>,
    agency_name: Option<String>,
    
    stops: Option<Vec<Stop>>,
    geometry: Option<String>,  // Encoded polyline
}


#[derive(Debug, Deserialize)]
struct Stop {
    stop_id: String,
    stop_name: String,
    geometry: Option<Vec<f64>>,  // [longitude, latitude]
    arrival_time: Option<i64>,
    departure_time: Option<i64>,
}

pub struct GraphHopperClient {
    client: Client,
    base_url: String,
}

impl GraphHopperClient {
    pub fn new() -> Self {
        let base_url = env::var("GRAPHHOPPER_URL")
            .unwrap_or_else(|_| "http://localhost:8989".to_string());
            
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");
            
        Self { client, base_url }
    }
    
    pub async fn get_transit_route(
        &self,
        from: &Location,
        to: &Location,
        departure_time: Option<DateTime<Utc>>,
    ) -> Result<(Duration, f64, Vec<TransitStep>)> {
        // Default to current time if not provided
        let departure = departure_time
            .unwrap_or_else(Utc::now)
            .to_rfc3339();
            
        let params = [
            ("point", format!("{},{}", from.latitude, from.longitude)),
            ("point", format!("{},{}", to.latitude, to.longitude)),
            ("pt.earliest_departure_time", departure),
            ("pt.profile", "true".to_string()),
            ("locale", "en".to_string()),
            ("details", "street_name".to_string()),
        ];

        let url = format!("{}/route-pt", self.base_url);

        let start_time = Instant::now();
        let response = self.client
            .get(&url)
            .query(&params)
            .send()
            .await?;
        
        let mut elapsed_time = start_time.elapsed(); 
        info!("Request to GraphHopper took {:?}", elapsed_time);

        let response_text = response.text().await?;
        elapsed_time = start_time.elapsed() - elapsed_time;
        info!("Response from GraphHopper textawait took {:?}", elapsed_time);
    
        match serde_json::from_str::<PtRouteResponse>(&response_text) {
            Ok(response_data) => {
                info!("Successfully parsed response as PtRouteResponse");
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
                error!("Failed to parse response as PtRouteResponse: {}", e);
                return Err(anyhow!("Failed to parse GraphHopper response: {}", e));
            }
        }
    }
    
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
                    
                    // Build instruction text
                    let instruction = if let Some(stops) = &leg.stops {
                        let from_stop = stops.first().map(|s| s.stop_name.as_str()).unwrap_or("Unknown");
                        let to_stop = stops.last().map(|s| s.stop_name.as_str()).unwrap_or("Unknown");
                        format!("Take {} {} from {} to {}", vehicle_type, trip_headsign, from_stop, to_stop)
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
                                short_name: Some(route_id.clone()),
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