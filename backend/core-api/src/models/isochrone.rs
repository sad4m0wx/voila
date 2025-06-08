use serde::{Deserialize, Serialize};
use geo::Polygon;
use crate::models::Location;

/// Request parameters for isochrone computation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IsochroneRequest {
    pub point: Location,
    pub time_limit: Option<u32>,
    pub distance_limit: Option<u32>,
    pub profile: Option<String>,
    pub buckets: Option<u32>,
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
    pub time_limit_minutes: u32,
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