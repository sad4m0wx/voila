use serde::{Deserialize, Serialize};
use geo::Polygon;
use crate::models::location::Location;

/// Request parameters for isochrone computation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IsochroneRequest {
    /// Starting point coordinates (latitude, longitude)
    pub point: Location,
    /// Time limit in seconds (default: 600)
    pub time_limit: Option<u32>,
    /// Distance limit in meters (optional, alternative to time_limit)
    pub distance_limit: Option<u32>,
    /// Routing profile (default: "pt")
    pub profile: Option<String>,
    /// Number of buckets for nested isochrones (default: 1)
    pub buckets: Option<u32>,
    /// Reverse flow direction (default: false)
    pub reverse_flow: Option<bool>,
}

/// GraphHopper API response structure
#[derive(Debug, Deserialize)]
pub struct GraphHopperIsochroneResponse {
    pub polygons: Vec<IsochroneFeature>,
    #[allow(dead_code)] // Used for deserialization but not accessed
    pub info: Option<IsochroneInfo>,
}

#[derive(Debug, Deserialize)]
pub struct IsochroneFeature {
    #[allow(dead_code)] // Used for deserialization but not accessed
    #[serde(rename = "type")]
    pub feature_type: String,
    pub geometry: IsochroneGeometry,
    pub properties: IsochroneProperties,
}

#[derive(Debug, Deserialize)]
pub struct IsochroneGeometry {
    #[allow(dead_code)] // Used for deserialization but not accessed
    #[serde(rename = "type")]
    pub geometry_type: String,
    pub coordinates: Vec<Vec<Vec<[f64; 2]>>>,
}

#[derive(Debug, Deserialize)]
pub struct IsochroneProperties {
    pub bucket: u32,
}

#[derive(Debug, Deserialize)]
pub struct IsochroneInfo {
    #[allow(dead_code)] // Used for deserialization but not accessed
    pub copyrights: Option<Vec<String>>,
    #[allow(dead_code)] // Used for deserialization but not accessed
    pub took: Option<u64>,
    #[allow(dead_code)] // Used for deserialization but not accessed
    pub road_data_timestamp: Option<String>,
}

/// Processed isochrone result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IsochroneResult {
    pub id: String,
    pub location: Location,
    pub time_limit_seconds: u32,
    pub profile: String,
    pub polygon: Polygon<f64>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub bucket: u32,
}

/// API response for isochrone endpoints
#[derive(Debug, Serialize)]
pub struct IsochroneResponse {
    pub success: bool,
    pub data: Option<IsochroneResult>,
    pub error: Option<String>,
}

impl Default for IsochroneRequest {
    fn default() -> Self {
        Self {
            point: Location::new(0.0, 0.0),
            time_limit: Some(600), // 10 minutes
            distance_limit: None,
            profile: Some("pt".to_string()),
            buckets: Some(1),
            reverse_flow: Some(false),
        }
    }
} 