use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransitStep {
    pub distance: f64,
    pub duration: u32, // seconds
    pub mode: String,  // "walking", "transit", etc.
    pub instructions: Option<String>,
    pub transit_details: Option<TransitDetails>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransitDetails {
    pub line: TransitLine,
    pub departure_stop: String,
    pub arrival_stop: String,
    pub departure_time: Option<String>,
    pub arrival_time: Option<String>,
    pub num_stops: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransitLine {
    pub name: String,
    pub short_name: Option<String>,
    pub color: String,
    pub vehicle_type: String, // "bus", "subway", "train", etc.
}

// For future GTFS implementation
#[derive(Debug, Clone)]
pub struct TransitGraph {
    pub stops: HashMap<String, TransitStop>,
    pub routes: HashMap<String, TransitRoute>,
    pub transfers: Vec<Transfer>,
}

#[derive(Debug, Clone)]
pub struct TransitStop {
    pub id: String,
    pub name: String,
    pub latitude: f64,
    pub longitude: f64,
}

#[derive(Debug, Clone)]
pub struct TransitRoute {
    pub id: String,
    pub short_name: Option<String>,
    pub long_name: Option<String>,
    pub route_type: u8,
    pub trips: Vec<Trip>,
}

#[derive(Debug, Clone)]
pub struct Trip {
    pub id: String,
    pub route_id: String,
    pub stop_times: Vec<StopTime>,
}

#[derive(Debug, Clone)]
pub struct StopTime {
    pub trip_id: String,
    pub stop_id: String,
    pub arrival_time: u32, // seconds from midnight
    pub departure_time: u32, // seconds from midnight
    pub stop_sequence: u32,
}

#[derive(Debug, Clone)]
pub struct Transfer {
    pub from_stop_id: String,
    pub to_stop_id: String,
    pub transfer_type: u8,
    pub min_transfer_time: Option<u32>,
}
