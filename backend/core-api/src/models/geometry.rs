use serde::{Deserialize, Serialize};
use crate::models::transit::TransitStep;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Route {
    pub id: String,
    pub geometry: LineString,
    pub steps: Vec<TransitStep>
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LineString {
    pub r#type: String, // Always "LineString"
    pub coordinates: Vec<(f64, f64)>, // Array of [longitude, latitude] points
}

impl LineString {
    pub fn new(coordinates: Vec<(f64, f64)>) -> Self {
        Self {
            r#type: "LineString".to_string(),
            coordinates,
        }
    }
} 