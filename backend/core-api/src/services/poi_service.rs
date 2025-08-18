use anyhow::{anyhow, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::env;
use std::time::{Duration, Instant};
use log::{info, debug};
use geo::{Point, Contains, Polygon};
use std::sync::Arc;
use chrono;
use crate::services::cache_service::CacheService;
use std::sync::Mutex;

use crate::models::{Location, CityHeatmap, HeatmapBoundingBox};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PointOfInterest {
    pub id: String,
    pub name: String,
    pub location: Location,
    pub poi_type: PoiType,
    pub importance: f64, // 0.0 to 1.0, higher = more important
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PoiType {
    TransitHub,      // Metro/train stations
    Neighborhood,    // place=neighbourhood|quarter|suburb|district|borough
    PublicSpace,     // Deprecated for snapping
    Street,          // Important streets/avenues (center point of ways)
    Venue,           // Restaurants, cafes, bars (kept for heatmap only)
    Other(String),
}

impl PoiType {
    pub fn importance_weight(&self) -> f64 {
        match self {
            PoiType::TransitHub => 0.8,      // Highest priority - excellent for meetings
            PoiType::Venue => 0.8,      // Good meeting spots
            PoiType::Neighborhood => 0.7,
            PoiType::PublicSpace => 0.6,
            PoiType::Street => 0.6,          // Streets less ideal than plazas
            PoiType::Other(_) => 0.5,        // Default weight
        }
    }
}

#[derive(Clone)]
pub struct PoiService {
    client: Client,
    overpass_url: String,
    cache_service: Arc<CacheService>,
    heatmap: Arc<Mutex<Option<CityHeatmap>>>,
}

impl PoiService {
    pub async fn new() -> Self {
        let overpass_url = env::var("OVERPASS_URL")
            .unwrap_or_else(|_| "https://overpass-api.de/api/interpreter".to_string());
            
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        let cache_service = CacheService::global().await;
        let heatmap = cache_service.get_cached_heatmap().await;

        Self {
            client,
            overpass_url,
            cache_service,
            heatmap: Arc::new(Mutex::new(heatmap)),
        }
    }

    pub async fn get_pois_in_polygons(&self, polygons: &[Polygon<f64>]) -> Result<Vec<PointOfInterest>> {
        if polygons.is_empty() {
            return Ok(Vec::new());
        }

        let start_time = Instant::now();

        let bbox = self.calculate_bounding_box(polygons);
        
        // Check if the bounding box is outside Paris bounds
        let paris_bbox = HeatmapBoundingBox {
            north: 48.9021,
            south: 48.8155,
            east: 2.4699,
            west: 2.2241,
        };
        
        // If the bounding box is completely outside Paris, return empty result
        if bbox.north < paris_bbox.south || bbox.south > paris_bbox.north ||
           bbox.east < paris_bbox.west || bbox.west > paris_bbox.east {
            info!("🏢 Bounding box outside Paris bounds, returning empty POI list");
            return Ok(Vec::new());
        }
        
        let mut all_pois = Vec::new();
        
        let transit_pois = self.fetch_transit_hubs(&bbox).await?;
        let venue_pois = self.fetch_venues(&bbox).await?;
        let public_space_pois = self.fetch_public_spaces(&bbox).await?;
        
        all_pois.extend(transit_pois);
        all_pois.extend(venue_pois);
        all_pois.extend(public_space_pois);
        
        // Filter POIs to only include those within intersection polygons
        let filtered_pois: Vec<PointOfInterest> = all_pois
            .into_iter()
            .filter(|poi| {
                let point = Point::new(poi.location.longitude, poi.location.latitude);
                polygons.iter().any(|polygon| polygon.contains(&point))
            })
            .collect();
        
        let elapsed_time = start_time.elapsed();
        info!("🏢 Found {} POIs within intersection polygons in {:?}", filtered_pois.len(), elapsed_time);
        Ok(filtered_pois)
    }

    async fn fetch_transit_hubs(&self, bbox: &BoundingBox) -> Result<Vec<PointOfInterest>> {
        let query = format!(
            r#"
            [out:json][timeout:25];
            (
              node["railway"="station"]({},{},{},{});
              node["public_transport"="station"]({},{},{},{});
              node["amenity"="bus_station"]({},{},{},{});
              node["highway"="bus_stop"]({},{},{},{});
              node["railway"="subway_entrance"]({},{},{},{});
            );
            out geom;
            "#,
            bbox.south, bbox.west, bbox.north, bbox.east,
            bbox.south, bbox.west, bbox.north, bbox.east,
            bbox.south, bbox.west, bbox.north, bbox.east,
            bbox.south, bbox.west, bbox.north, bbox.east,
            bbox.south, bbox.west, bbox.north, bbox.east,
        );

        self.execute_overpass_query(&query, PoiType::TransitHub).await
    }

    async fn fetch_transit_hubs_metro_only(&self, bbox: &BoundingBox) -> Result<Vec<PointOfInterest>> {
        let query = format!(
            r#"
            [out:json][timeout:25];
            (
              node["railway"="station"]({},{},{},{});
              node["public_transport"="station"]({},{},{},{});
              node["railway"="subway_entrance"]({},{},{},{});
            );
            out geom;
            "#,
            bbox.south, bbox.west, bbox.north, bbox.east,
            bbox.south, bbox.west, bbox.north, bbox.east,
            bbox.south, bbox.west, bbox.north, bbox.east,
        );

        self.execute_overpass_query(&query, PoiType::TransitHub).await
    }

    async fn fetch_venues(&self, bbox: &BoundingBox) -> Result<Vec<PointOfInterest>> {
        let query = format!(
            r#"
            [out:json][timeout:25];
            (
              node["amenity"="restaurant"]({},{},{},{});
              node["amenity"="cafe"]({},{},{},{});
              node["amenity"="bar"]({},{},{},{});
              node["amenity"="pub"]({},{},{},{});
            );
            out geom;
            "#,
            bbox.south, bbox.west, bbox.north, bbox.east,
            bbox.south, bbox.west, bbox.north, bbox.east,
            bbox.south, bbox.west, bbox.north, bbox.east,
            bbox.south, bbox.west, bbox.north, bbox.east,
        );

        self.execute_overpass_query(&query, PoiType::Venue).await
    }

    async fn fetch_public_spaces(&self, bbox: &BoundingBox) -> Result<Vec<PointOfInterest>> {
        let query = format!(
            r#"
            [out:json][timeout:25];
            (
              node["leisure"="park"]({},{},{},{});
              node["place"="square"]({},{},{},{});
              node["tourism"="attraction"]({},{},{},{});
              way["leisure"="park"]({},{},{},{});
              way["place"="square"]({},{},{},{});
            );
            out center geom;
            "#,
            bbox.south, bbox.west, bbox.north, bbox.east,
            bbox.south, bbox.west, bbox.north, bbox.east,
            bbox.south, bbox.west, bbox.north, bbox.east,
            bbox.south, bbox.west, bbox.north, bbox.east,
            bbox.south, bbox.west, bbox.north, bbox.east,
        );

        self.execute_overpass_query(&query, PoiType::PublicSpace).await
    }

    async fn fetch_neighborhoods(&self, bbox: &BoundingBox) -> Result<Vec<PointOfInterest>> {
        let query = format!(
            r#"
            [out:json][timeout:25];
            (
              node["place"~"neighbourhood|quarter|suburb|district|borough"]["name"]({},{},{},{});
              way["place"~"neighbourhood|quarter|suburb|district|borough"]["name"]({},{},{},{});
            );
            out center geom;
            "#,
            bbox.south, bbox.west, bbox.north, bbox.east,
            bbox.south, bbox.west, bbox.north, bbox.east,
        );

        self.execute_overpass_query(&query, PoiType::Neighborhood).await
    }

    async fn fetch_important_streets(&self, bbox: &BoundingBox) -> Result<Vec<PointOfInterest>> {
        let query = format!(
            r#"
            [out:json][timeout:25];
            (
              way["highway"~"trunk|primary|secondary|tertiary"]["name"]({},{},{},{});
            );
            out geom;
            "#,
            bbox.south, bbox.west, bbox.north, bbox.east,
        );

        self.execute_overpass_query(&query, PoiType::Street).await
    }

    async fn execute_overpass_query(&self, query: &str, poi_type: PoiType) -> Result<Vec<PointOfInterest>> {
        debug!("Executing Overpass query for {:?}", poi_type);
        let start_time = Instant::now();

        let response = self.client
            .post(&self.overpass_url)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(format!("data={}", urlencoding::encode(query)))
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow!("Overpass API request failed: {}", response.status()));
        }

        let overpass_response: OverpassResponse = response.json().await?;
        
        let pois: Vec<PointOfInterest> = overpass_response.elements
            .into_iter()
            .filter_map(|element| self.convert_overpass_element_to_poi(element, &poi_type))
            .collect();

            
        let elapsed_time = start_time.elapsed();
        info!("Converted {} elements to POIs for {:?} in {:?}", pois.len(), poi_type, elapsed_time);
        Ok(pois)
    }

    fn convert_overpass_element_to_poi(&self, element: OverpassElement, poi_type: &PoiType) -> Option<PointOfInterest> {
        let (lat, lon) = match element.element_type.as_str() {
            "node" => (element.lat?, element.lon?),
            "way" => {
                if let Some(center) = element.center {
                    (center.lat, center.lon)
                } else if let Some(ref geom) = element.geometry {
                    if geom.is_empty() { return None; }
                    let mid = geom.len() / 2;
                    (geom[mid].lat, geom[mid].lon)
                } else {
                    return None;
                }
            },
            _ => return None,
        };

        let name = element.tags.get("name")
            .or_else(|| element.tags.get("operator"))
            .or_else(|| element.tags.get("brand"))
            .cloned()
            .unwrap_or_else(|| format!("Unnamed {}", match poi_type {
                PoiType::TransitHub => "Transit Hub",
                PoiType::Neighborhood => "Neighborhood",
                PoiType::Street => "Street",
                PoiType::Venue => "Venue",
                PoiType::PublicSpace => "Public Space",
                _ => "Location",
            }));

        // Calculate importance based on tags and type
        let importance = self.calculate_poi_importance(&element.tags, poi_type);

        Some(PointOfInterest {
            id: format!("osm_{}_{}", element.element_type, element.id),
            name,
            location: Location::new(lat, lon),
            poi_type: poi_type.clone(),
            importance,
            tags: element.tags.keys().cloned().collect(),
        })
    }
    
    pub fn calculate_location_heat(&self, location: &Location, all_pois: &[PointOfInterest]) -> f64 {
        let mut heat = 0.0;
        
        // Factor 1: Proximity to transit hubs (45% weight)
        let transit_heat = self.calculate_transit_proximity_heat(location, all_pois);
        heat += transit_heat * 0.45;
        
        // Factor 2: Density of venues nearby (45% weight)
        let dining_heat = self.calculate_venue_density_heat(location, all_pois);
        heat += dining_heat * 0.45;
        
        // Factor 3: Overall POI density (10% weight)
        let poi_density_heat = self.calculate_poi_density_heat(location, all_pois);
        heat += poi_density_heat * 0.1;
        
        // Apply non-linear scaling to improve granularity and reduce high-scoring areas
        //heat = self.apply_sigmoid_scaling(heat);
        
        debug!("Transit heat: {:.3}, Dining heat: {:.3}, POI density heat: {:.3}, Raw combined: {:.3}, Final heat: {:.3}", 
               transit_heat, dining_heat, poi_density_heat, 
               transit_heat * 0.45 + dining_heat * 0.45 + poi_density_heat * 0.1, heat);
        heat
    }
    

    fn calculate_transit_proximity_heat(&self, location: &Location, all_pois: &[PointOfInterest]) -> f64 {
        let transit_hubs: Vec<&PointOfInterest> = all_pois.iter()
            .filter(|poi| matches!(poi.poi_type, PoiType::TransitHub))
            .collect();
        
        if transit_hubs.is_empty() {
            return 0.0;
        }
        
        let mut total_heat = 0.0;
        const MAX_TRANSIT_DISTANCE: f64 = 200.0; // Reduced from 1km for more granular scoring
        const DISTANCE_DECAY_RATE: f64 = 3.0; // Increased for steeper distance penalty
        
        // Calculate distance-based heat for all transit hubs within range
        for hub in &transit_hubs {
            let distance = location.distance_to(&hub.location);
            
            if distance <= MAX_TRANSIT_DISTANCE {
                let normalized_distance = distance / MAX_TRANSIT_DISTANCE;
                let proximity_score = (-DISTANCE_DECAY_RATE * normalized_distance).exp();
                
                let weighted_score = proximity_score * hub.importance;
                total_heat += weighted_score;
            }
        }
        
        let normalization_factor = (transit_hubs.len() as f64 * 0.05).max(0.5);
        let normalized_heat = total_heat / normalization_factor;
        normalized_heat.min(1.0) // Cap at 1.0
    }

    fn calculate_venue_density_heat(&self, location: &Location, all_pois: &[PointOfInterest]) -> f64 {
        let dining_pois: Vec<&PointOfInterest> = all_pois.iter()
            .filter(|poi| matches!(poi.poi_type, PoiType::Venue))
            .collect();
        
        if dining_pois.is_empty() {
            return 0.0;
        }
        
        let mut total_heat = 0.0;
        const MAX_VENUE_DISTANCE: f64 = 600.0; // Reduced from 1km for more granular scoring
        const VENUE_DECAY_RATE: f64 = 2.0; // Steeper than before but less than transit
        
        // Calculate distance-based heat for all venues within range
        for venue in &dining_pois {
            let distance = location.distance_to(&venue.location);
            
            if distance <= MAX_VENUE_DISTANCE {
                let normalized_distance = distance / MAX_VENUE_DISTANCE;
                let proximity_score = (-VENUE_DECAY_RATE * normalized_distance).exp();
                let weighted_score = proximity_score * venue.importance;
                total_heat += weighted_score;
            }
        }
        
        let normalization_factor = (dining_pois.len() as f64 * 0.03).max(2.0);
        let normalized_heat = total_heat / normalization_factor;
        normalized_heat.min(1.0) // Cap at 1.0
    }

    fn calculate_poi_density_heat(&self, location: &Location, all_pois: &[PointOfInterest]) -> f64 {
        if all_pois.is_empty() {
            return 0.0;
        }
        
        const DENSITY_RADIUS: f64 = 300.0;
        
        let mut weighted_count = 0.0;
        
        // Use distance-weighted scoring instead of simple count
        for poi in all_pois {
            let distance = location.distance_to(&poi.location);
            if distance <= DENSITY_RADIUS {
                let normalized_distance = distance / DENSITY_RADIUS;
                let distance_weight = (-1.0 * normalized_distance).exp(); // Gentle decay
                weighted_count += poi.importance * distance_weight;
            }
        }
        
        if weighted_count == 0.0 {
            return 0.0;
        }
        
        let normalization_factor = (all_pois.len() as f64 * 0.01).max(1.5);
        let density_score = weighted_count / normalization_factor;
        density_score.min(1.0) // Cap at 1.0
    }

    fn calculate_poi_importance(&self, tags: &std::collections::HashMap<String, String>, poi_type: &PoiType) -> f64 {
        let mut importance = poi_type.importance_weight();

        match poi_type {
            // Keep transit simple: stations slightly above entrances, no tourist signals
            PoiType::TransitHub => {
                if let Some(railway) = tags.get("railway") {
                    match railway.as_str() {
                        "station" => importance += 0.15,
                        "subway_entrance" => importance += 0.05,
                        _ => {}
                    }
                }
                if let Some(public_transport) = tags.get("public_transport") {
                    if public_transport == "station" { importance += 0.10; }
                }
            }
            // Larger administrative places weigh more than tiny neighbourhoods
            PoiType::Neighborhood => {
                if let Some(place) = tags.get("place") {
                    importance += match place.as_str() {
                        "district" | "borough" => 0.20,
                        "suburb" => 0.15,
                        "quarter" => 0.10,
                        "neighbourhood" => 0.05,
                        _ => 0.0,
                    };
                }
            }
            // Prefer classic civic spaces; avoid tourist/heritage signals entirely
            PoiType::PublicSpace => {
                if tags.get("place").map(|v| v == "square").unwrap_or(false) { importance += 0.15; }
                if let Some(amenity) = tags.get("amenity") {
                    if amenity == "marketplace" { importance += 0.15; }
                    if amenity == "townhall" { importance += 0.05; }
                }
            }
            // Streets: rank by highway class and common major-street names
            PoiType::Street => {
                if let Some(highway) = tags.get("highway") {
                    importance += match highway.as_str() {
                        "trunk" => 0.40,
                        "primary" => 0.30,
                        "secondary" => 0.15,
                        "tertiary" => 0.08,
                        _ => 0.0,
                    };
                }
                if let Some(name) = tags.get("name") {
                    let n = name.to_lowercase();
                    if n.contains("avenue") || n.contains("boulevard") || n.contains("bd ") || n.starts_with("bd") || n.contains("quai") {
                        importance += 0.1;
                    }
                }
            }
            _ => {}
        }

        importance.clamp(0.0, 1.0)
    }

    fn calculate_bounding_box(&self, polygons: &[Polygon<f64>]) -> BoundingBox {
        let mut min_lat = f64::INFINITY;
        let mut max_lat = f64::NEG_INFINITY;
        let mut min_lon = f64::INFINITY;
        let mut max_lon = f64::NEG_INFINITY;

        for polygon in polygons {
            for coord in polygon.exterior().coords() {
                min_lat = min_lat.min(coord.y);
                max_lat = max_lat.max(coord.y);
                min_lon = min_lon.min(coord.x);
                max_lon = max_lon.max(coord.x);
            }
        }

        BoundingBox {
            north: max_lat,
            south: min_lat,
            east: max_lon,
            west: min_lon,
        }
    }

    pub fn deduplicate_candidates_by_heat(&self, candidates: &[(Location, f64)], min_distance_meters: f64) -> Vec<(Location, f64)> {
        if candidates.is_empty() {
            return Vec::new();
        }

        let mut deduplicated = Vec::new();
        let mut used_indices = std::collections::HashSet::new();

        for (i, (candidate, heat)) in candidates.iter().enumerate() {
            if used_indices.contains(&i) {
                continue;
            }

            let mut best_candidate = candidate.clone();
            let mut best_heat = *heat;
            let mut best_index = i;

            // Find all candidates within min_distance and pick the best one
            for (j, (other_candidate, other_heat)) in candidates.iter().enumerate().skip(i + 1) {
                if used_indices.contains(&j) {
                    continue;
                }

                let distance = candidate.distance_to(other_candidate);
                if distance <= min_distance_meters {
                    if *other_heat > best_heat {
                        best_candidate = other_candidate.clone();
                        best_heat = *other_heat;
                        best_index = j;
                    }
                    used_indices.insert(j);
                }
            }

            used_indices.insert(best_index);
            deduplicated.push((best_candidate, best_heat));
        }

        info!("🎯 Deduplicated {} → {} candidates (min distance: {}m)", 
              candidates.len(), deduplicated.len(), min_distance_meters);
        
        deduplicated
    }

    /// Generate a citywide heatmap for Paris and cache it
    pub async fn generate_paris_heatmap(&self) -> Result<CityHeatmap> {
        info!("🗺️ Generating Paris citywide heatmap...");
        
        // Paris + suburbs bounding box (covers greater Paris area)
        let paris_bbox = HeatmapBoundingBox {
            north: 49.05,   // North of Paris, covers northern suburbs
            south: 48.75,   // South of Paris, covers southern suburbs
            east: 2.60,     // East of Paris, covers eastern suburbs
            west: 2.10,     // West of Paris, covers western suburbs
        };
        
        const GRID_SIZE: usize = 200; // 200x200 grid for fine-grained heat
        let lat_range = paris_bbox.north - paris_bbox.south;
        let lon_range = paris_bbox.east - paris_bbox.west;
        let cell_size_degrees = lat_range.max(lon_range) / GRID_SIZE as f64;
        
        info!("📐 Grid size: {}x{}, Cell size: {:.6} degrees (~{}m)", 
              GRID_SIZE, GRID_SIZE, cell_size_degrees, (cell_size_degrees * 111000.0) as u32);

        // Fetch all POIs for Paris
        let _paris_polygon = Polygon::new(
            geo::LineString::from(vec![
                (paris_bbox.west, paris_bbox.south),
                (paris_bbox.east, paris_bbox.south),
                (paris_bbox.east, paris_bbox.north),
                (paris_bbox.west, paris_bbox.north),
                (paris_bbox.west, paris_bbox.south),
            ]),
            vec![],
        );
        
        let start_time = Instant::now();
        let bbox = BoundingBox {
            north: paris_bbox.north,
            south: paris_bbox.south,
            east: paris_bbox.east,
            west: paris_bbox.west,
        };
        
        info!("🔍 Fetching POIs for Paris...");
        let mut all_pois = Vec::new();
        
        // Fetch all POI types in parallel
        let (transit_pois, venue_pois, public_space_pois) = tokio::join!(
            self.fetch_transit_hubs(&bbox),
            self.fetch_venues(&bbox),
            self.fetch_public_spaces(&bbox)
        );
        
        all_pois.extend(transit_pois?);
        all_pois.extend(venue_pois?);
        all_pois.extend(public_space_pois?);
        
        let poi_fetch_time = start_time.elapsed();
        info!("🏢 Fetched {} POIs for Paris in {:?}", all_pois.len(), poi_fetch_time);
        
        // Generate heat grid
        info!("🔥 Computing heat grid...");
        let grid_start = Instant::now();
        let mut heat_grid = vec![vec![0.0f64; GRID_SIZE]; GRID_SIZE];
        let mut max_heat = 0.0f64;
        
        for i in 0..GRID_SIZE {
            for j in 0..GRID_SIZE {
                let lat = paris_bbox.south + (i as f64) * (lat_range / GRID_SIZE as f64);
                let lon = paris_bbox.west + (j as f64) * (lon_range / GRID_SIZE as f64);
                let location = Location::new(lat, lon);
                
                let heat = self.calculate_location_heat(&location, &all_pois);
                heat_grid[i][j] = heat;
                max_heat = max_heat.max(heat);
            }
            
            if i % 20 == 0 {
                info!("🔥 Heat grid progress: {:.1}%", (i as f64 / GRID_SIZE as f64) * 100.0);
            }
        }
        
        // Normalize heat values to 0-1 range
        if max_heat > 0.0 {
            for i in 0..GRID_SIZE {
                for j in 0..GRID_SIZE {
                    heat_grid[i][j] /= max_heat;
                }
            }
        }
        
        let grid_time = grid_start.elapsed();
        info!("🔥 Heat grid computed in {:?}", grid_time);
        
        let heatmap = CityHeatmap {
            city_name: "Paris".to_string(),
            bounding_box: paris_bbox,
            grid_size: GRID_SIZE,
            cell_size_degrees,
            heat_grid,
            creation_timestamp: chrono::Utc::now().timestamp(),
            poi_count: all_pois.len(),
        };
        
        // Cache the heatmap
        self.cache_service.cache_heatmap(&heatmap).await?;
        
        let total_time = start_time.elapsed();
        info!("🗺️ Paris heatmap generated successfully in {:?} with {} POIs", total_time, all_pois.len());
        
        Ok(heatmap)
    }

    pub async fn get_location_heat(&self, location: &Location) -> Option<f64> {
        if let Some(heatmap) = self.heatmap.lock().unwrap().as_ref() {
            return Some(self.calculate_heat_from_grid(location, &heatmap));
        } else {
            // If no heatmap is available, return 0.0 for locations outside Paris
            // or create a small bounding box around the location for POI fetching
            let paris_bbox = HeatmapBoundingBox {
                north: 48.9021,
                south: 48.8155,
                east: 2.4699,
                west: 2.2241,
            };
            
            // Check if location is within Paris bounds
            if location.latitude < paris_bbox.south || location.latitude > paris_bbox.north ||
               location.longitude < paris_bbox.west || location.longitude > paris_bbox.east {
                return Some(0.0); // Outside Paris bounds, return 0 heat
            }
            
            // Create a small bounding box around the location for POI fetching
            let bbox_size = 0.01; // ~1km radius
            let search_polygon = Polygon::new(
                geo::LineString::from(vec![
                    (location.longitude - bbox_size, location.latitude - bbox_size),
                    (location.longitude + bbox_size, location.latitude - bbox_size),
                    (location.longitude + bbox_size, location.latitude + bbox_size),
                    (location.longitude - bbox_size, location.latitude + bbox_size),
                    (location.longitude - bbox_size, location.latitude - bbox_size),
                ]),
                vec![],
            );
            
            let all_pois = self.get_pois_in_polygons(&[search_polygon]).await.unwrap_or_default();
            Some(self.calculate_location_heat(location, &all_pois))
        }
    }

    fn calculate_heat_from_grid(&self, location: &Location, heatmap: &CityHeatmap) -> f64 {
        let bbox = &heatmap.bounding_box;
        
        if location.latitude < bbox.south || location.latitude > bbox.north ||
           location.longitude < bbox.west || location.longitude > bbox.east {
            return 0.0; // Outside Paris bounds
        }
        
        let lat_range = bbox.north - bbox.south;
        let lon_range = bbox.east - bbox.west;
        
        let grid_lat = ((location.latitude - bbox.south) / lat_range) * heatmap.grid_size as f64;
        let grid_lon = ((location.longitude - bbox.west) / lon_range) * heatmap.grid_size as f64;
        
        let lat_floor = grid_lat.floor() as usize;
        let lon_floor = grid_lon.floor() as usize;
        let lat_ceil = (lat_floor + 1).min(heatmap.grid_size - 1);
        let lon_ceil = (lon_floor + 1).min(heatmap.grid_size - 1);
        
        let lat_frac = grid_lat - lat_floor as f64;
        let lon_frac = grid_lon - lon_floor as f64;
        
        let heat_tl = heatmap.heat_grid[lat_floor][lon_floor]; // top-left
        let heat_tr = heatmap.heat_grid[lat_floor][lon_ceil];  // top-right
        let heat_bl = heatmap.heat_grid[lat_ceil][lon_floor];  // bottom-left
        let heat_br = heatmap.heat_grid[lat_ceil][lon_ceil];   // bottom-right
        
        let heat_top = heat_tl * (1.0 - lon_frac) + heat_tr * lon_frac;
        let heat_bottom = heat_bl * (1.0 - lon_frac) + heat_br * lon_frac;
        let final_heat = heat_top * (1.0 - lat_frac) + heat_bottom * lat_frac;
        
        final_heat.clamp(0.0, 1.0)
    }

    pub async fn find_nearest_snap_poi(&self, location: &Location, search_radius_meters: f64) -> Result<Option<PointOfInterest>> {
        
        // Convert meters to degrees (approximation)
        let lat_radius_deg = search_radius_meters / 111_000.0;
        let lon_radius_deg = search_radius_meters / (111_000.0 * location.latitude.to_radians().cos().abs().max(0.1));

        let bbox = BoundingBox {
            north: location.latitude + lat_radius_deg,
            south: location.latitude - lat_radius_deg,
            east: location.longitude + lon_radius_deg,
            west: location.longitude - lon_radius_deg,
        };

        let (transit_res, neighborhoods_res, streets_res) = tokio::join!(
            self.fetch_transit_hubs_metro_only(&bbox),
            self.fetch_neighborhoods(&bbox),
            self.fetch_important_streets(&bbox),
        );

        let mut candidates: Vec<PointOfInterest> = [
            transit_res,
            neighborhoods_res,
            streets_res,
        ]
        .into_iter()
        .filter_map(Result::ok)
        .flatten()
        .collect();

        // If no candidates found, relax transit filter to include bus stops and re-fetch streets
        if candidates.is_empty() {
            let (transit_relaxed, streets_relaxed) = tokio::join!(
                self.fetch_transit_hubs(&bbox),
                self.fetch_important_streets(&bbox)
            );
            if let Ok(mut v) = transit_relaxed { candidates.append(&mut v); }
            if let Ok(mut v) = streets_relaxed { candidates.append(&mut v); }
        }

        let mut filtered: Vec<(PointOfInterest, f64, u8)> = candidates
            .into_iter()
            .map(|poi| {
                let distance = location.distance_to(&poi.location);
                let priority = match poi.poi_type {
                    PoiType::TransitHub => 0,
                    PoiType::Street => 1,
                    PoiType::Neighborhood => 2,
                    _ => 3,
                };
                (poi, distance, priority)
            })
            .filter(|(_, distance, _)| *distance <= search_radius_meters)
            .collect();

        if filtered.is_empty() {
            return Ok(None);
        }

        filtered.sort_by(|a, b| {
            a.2.cmp(&b.2)
                .then_with(|| b.0.importance.partial_cmp(&a.0.importance).unwrap_or(std::cmp::Ordering::Equal))
                .then_with(|| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
        });

        if let Some((poi, _, _)) = filtered.into_iter().next() {
            return Ok(Some(poi));
        }
        
        Ok(None)
    }
}

#[derive(Debug)]
struct BoundingBox {
    north: f64,
    south: f64,
    east: f64,
    west: f64,
}

#[derive(Debug, Deserialize)]
struct OverpassResponse {
    elements: Vec<OverpassElement>,
}

#[derive(Debug, Deserialize)]
struct OverpassElement {
    #[serde(rename = "type")]
    element_type: String,
    id: u64,
    lat: Option<f64>,
    lon: Option<f64>,
    center: Option<OverpassCenter>,
    #[serde(default)]
    geometry: Option<Vec<OverpassCenter>>, 
    tags: std::collections::HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
struct OverpassCenter {
    lat: f64,
    lon: f64,
} 