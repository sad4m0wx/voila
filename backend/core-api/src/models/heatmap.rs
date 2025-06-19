use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CityHeatmap {
    pub city_name: String,
    pub bounding_box: HeatmapBoundingBox,
    pub grid_size: usize,
    pub cell_size_degrees: f64,
    pub heat_grid: Vec<Vec<f64>>, // 2D grid of heat values (0.0 to 1.0)
    pub creation_timestamp: i64,
    pub poi_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeatmapBoundingBox {
    pub north: f64,
    pub south: f64,
    pub east: f64,
    pub west: f64,
} 