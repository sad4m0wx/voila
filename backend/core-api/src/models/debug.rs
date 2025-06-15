use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugData {
    pub geometric_centroid: (f64, f64), // [longitude, latitude]
    pub isochrones: Vec<DebugIsochrone>,
    pub intersection_polygons: Vec<DebugPolygon>,
    pub candidate_points: Vec<DebugCandidate>,
    pub final_candidates: Vec<DebugCandidate>,
    // Isochrone data for visualization
    pub isochrone_data: Option<Vec<DebugIsochroneData>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugIsochrone {
    pub origin_id: String,
    pub time_limit_minutes: f64,
    pub area_km2: f64,
    pub polygon: DebugPolygon,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugPolygon {
    pub r#type: String, // "Polygon"
    pub coordinates: Vec<Vec<(f64, f64)>>, // GeoJSON format: [exterior, ...holes]
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugCandidate {
    pub id: String,
    pub coordinates: (f64, f64), // [longitude, latitude]
    pub source: String, // "intersection", "noise", "centroid"
    pub score: Option<f64>, // Total travel time score in minutes
}

/// Isochrone data for debugging and visualization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugIsochroneData {
    pub origin_id: String,
    pub location: (f64, f64), // [longitude, latitude]
    pub time_limit_minutes: f64,
    pub profile: String,
    
    // Isochrone polygon data
    pub polygon_area_km2: f64,
    pub polygon_vertices: usize,
    pub algorithm_used: String,
    pub computation_time_ms: u64,
} 