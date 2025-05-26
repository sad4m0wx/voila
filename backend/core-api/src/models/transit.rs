use serde::{Deserialize, Serialize};


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransitStep {
    pub distance: f64,
    pub duration: u32, // seconds
    pub mode: String,  // "walking", "transit", etc.
    pub instructions: Option<String>,
    pub transit_details: Option<TransitDetails>,
    pub geometry: Option<GeoJson>, // Polyline or GeoJSON
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct GeoJson {
    #[serde(rename = "type")]
    pub geo_type: String,
    pub coordinates: Vec<Vec<f64>>,
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