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
    // Heatmap data for visualization
    pub heatmap_data: Option<DebugHeatmapData>,
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

/// Heatmap data for POI-based visualization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugHeatmapData {
    pub bounding_box: DebugBoundingBox,
    pub grid_size: usize,
    pub heat_values: Vec<Vec<f64>>, // 2D grid of heat values (0.0 to 1.0)
    pub poi_locations: Vec<DebugPOI>,
    pub optimization_stats: DebugOptimizationStats,
    pub candidate_movements: Vec<DebugCandidateMovement>, // Movement vectors
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugBoundingBox {
    pub north: f64,
    pub south: f64,
    pub east: f64,
    pub west: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugPOI {
    pub id: String,
    pub name: String,
    pub coordinates: (f64, f64), // [longitude, latitude]
    pub poi_type: String,
    pub importance: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugOptimizationStats {
    pub original_candidates: usize,
    pub optimized_candidates: usize,
    pub candidates_moved: usize,
    pub average_movement_distance: f64, // in meters
    pub min_heat_threshold: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugCandidateMovement {
    pub original_position: (f64, f64), // [longitude, latitude]
    pub final_position: (f64, f64),    // [longitude, latitude]
    pub movement_distance: f64,        // in meters
    pub heat_improvement: f64,         // heat score improvement
    pub was_kept: bool,                // whether candidate passed threshold
}