// src/services/graphhopper_client.rs

use anyhow::{anyhow, Result};
use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::env;
use std::time::Duration;

use crate::models::location::Location;
use crate::models::transit::{TransitDetails, TransitLine, TransitStep};

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
struct Path {
    distance: f64,
    time: i64,
    legs: Vec<Leg>,
    instructions: Vec<Instruction>,
}

#[derive(Debug, Deserialize)]
struct Leg {
    distance: f64,
    time: i64,
    trip_id: Option<String>,
    route_id: Option<String>,
    // Other fields...
}

#[derive(Debug, Deserialize)]
struct Instruction {
    text: String,
    time: i64,
    distance: f64,
    sign: i32,
    // Other fields...
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
            .timestamp();
            
        let request = GraphHopperRequest {
            points: vec![
                vec![from.longitude, from.latitude],
                vec![to.longitude, to.latitude],
            ],
            point_hints: vec![],
            snap_preventions: vec!["motorway".to_string()],
            details: vec!["time".to_string(), "distance".to_string()],
            profile: "pt".to_string(),
            locale: "en".to_string(),
            pt: PtSettings {
                earliest_departure_time: departure,
                profile_duration: true,
                ignore_transfers: false,
                walk_speed: 5.0,
            },
        };
        
        let url = format!("{}/route", self.base_url);
        
        let response: GraphHopperResponse = self.client
            .post(&url)
            .json(&request)
            .send()
            .await?
            .json()
            .await?;
            
        if response.paths.is_empty() {
            return Err(anyhow!("No route found"));
        }
        
        let path = &response.paths[0];
        let duration = Duration::from_millis(path.time as u64);
        let distance = path.distance;
        
        // Convert GraphHopper instructions to our TransitStep model
        let steps = self.convert_to_transit_steps(path)?;
        
        Ok((duration, distance, steps))
    }
    
    fn convert_to_transit_steps(&self, path: &Path) -> Result<Vec<TransitStep>> {
        let mut steps = Vec::new();
        
        // Simplified conversion - in reality, you'd need to handle different instruction types
        for (i, instruction) in path.instructions.iter().enumerate() {
            let is_transit = path.legs.get(i)
                .map(|leg| leg.trip_id.is_some())
                .unwrap_or(false);
                
            let step = if is_transit {
                // This is a transit segment
                let leg = &path.legs[i];
                
                TransitStep {
                    distance: instruction.distance,
                    duration: (instruction.time / 1000) as u32, // Convert ms to seconds
                    mode: "transit".to_string(),
                    instructions: Some(instruction.text.clone()),
                    transit_details: Some(TransitDetails {
                        line: TransitLine {
                            name: leg.route_id.clone().unwrap_or_default(),
                            short_name: None,
                            color: "#1a73e8".to_string(), // Default color
                            vehicle_type: "bus".to_string(), // Default type
                        },
                        departure_stop: "".to_string(), // Would need to extract from instruction
                        arrival_stop: "".to_string(),   // Would need to extract from instruction
                        departure_time: None,           // Would need to extract from leg
                        arrival_time: None,             // Would need to extract from leg
                        num_stops: 0,                   // Would need to calculate
                    }),
                }
            } else {
                // This is a walking segment
                TransitStep {
                    distance: instruction.distance,
                    duration: (instruction.time / 1000) as u32, // Convert ms to seconds
                    mode: "walking".to_string(),
                    instructions: Some(instruction.text.clone()),
                    transit_details: None,
                }
            };
            
            steps.push(step);
        }
        
        Ok(steps)
    }
}