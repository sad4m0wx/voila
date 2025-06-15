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

#[derive(Debug, Deserialize)]
pub struct GraphHopperIsochroneResponse {
    pub polygons: Vec<IsochroneFeature>,
}

#[derive(Debug, Deserialize)]
pub struct IsochroneFeature {
    pub geometry: IsochroneGeometry,
    pub properties: IsochroneProperties,
}

#[derive(Debug, Deserialize)]
pub struct IsochroneGeometry {
    pub coordinates: Vec<Vec<Vec<[f64; 2]>>>,
}

#[derive(Debug, Deserialize)]
pub struct IsochroneProperties {
    pub bucket: u32,
}

/// Processed isochrone result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IsochroneResult {
    pub location: Location,
    pub time_limit_minutes: u32,
    pub profile: String,
    pub polygon: Polygon<f64>,
}

/// API response for isochrone endpoints
#[derive(Debug, Serialize)]
pub struct IsochroneResponse {
    pub success: bool,
    pub data: Option<IsochroneResult>,
    pub error: Option<String>,
}