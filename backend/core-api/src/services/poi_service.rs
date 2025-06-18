use anyhow::{anyhow, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::env;
use std::time::Duration;
use log::{error, info, debug};
use geo::{Point, Contains, Polygon};

use crate::models::Location;

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
    TransitHub,      // Metro stations, bus terminals, train stations
    Venue,      // Restaurants, cafes, bars
    Shopping,        // Malls, markets, shops
    Entertainment,   // Cinemas, theaters, parks
    PublicSpace,     // Squares, plazas, landmarks
    Other(String),
}

impl PoiType {
    pub fn importance_weight(&self) -> f64 {
        match self {
            PoiType::TransitHub => 0.8,      // Highest priority - excellent for meetings
            PoiType::Venue => 0.8,      // Good meeting spots
            PoiType::PublicSpace => 0.6,     // Public squares, landmarks
            PoiType::Shopping => 0.6,        // Malls, markets
            PoiType::Entertainment => 0.6,   // Parks, cinemas
            PoiType::Other(_) => 0.5,        // Default weight
        }
    }
}

#[derive(Clone)]
pub struct PoiService {
    client: Client,
    overpass_url: String,
}

impl PoiService {
    pub fn new() -> Self {
        let overpass_url = env::var("OVERPASS_URL")
            .unwrap_or_else(|_| "https://overpass-api.de/api/interpreter".to_string());
            
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self { client, overpass_url }
    }

    pub async fn get_pois_in_polygons(&self, polygons: &[Polygon<f64>]) -> Result<Vec<PointOfInterest>> {
        if polygons.is_empty() {
            return Ok(Vec::new());
        }

        let bbox = self.calculate_bounding_box(polygons);
        
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
        
        info!("🏢 Found {} POIs within intersection polygons", filtered_pois.len());
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

    async fn execute_overpass_query(&self, query: &str, poi_type: PoiType) -> Result<Vec<PointOfInterest>> {
        debug!("Executing Overpass query for {:?}", poi_type);
        
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

        debug!("Converted {} elements to POIs for {:?}", pois.len(), poi_type);
        Ok(pois)
    }

    fn convert_overpass_element_to_poi(&self, element: OverpassElement, poi_type: &PoiType) -> Option<PointOfInterest> {
        let (lat, lon) = match element.element_type.as_str() {
            "node" => (element.lat?, element.lon?),
            "way" => {
                // Use center coordinates for ways
                if let Some(center) = element.center {
                    (center.lat, center.lon)
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
        
        // Factor 1: Proximity to transit hubs (35% weight)
        let transit_heat = self.calculate_transit_proximity_heat(location, all_pois);
        heat += transit_heat * 0.35;
        
        // Factor 2: Density of venues nearby (45% weight)
        let dining_heat = self.calculate_venue_density_heat(location, all_pois);
        heat += dining_heat * 0.45;
        
        // Factor 3: Overall POI density (20% weight)
        let poi_density_heat = self.calculate_poi_density_heat(location, all_pois);
        heat += poi_density_heat * 0.20;
        
        // Apply non-linear scaling to improve granularity and reduce high-scoring areas
        heat = self.apply_sigmoid_scaling(heat);
        
        info!("Transit heat: {:.3}, Dining heat: {:.3}, POI density heat: {:.3}, Raw combined: {:.3}, Final heat: {:.3}", 
               transit_heat, dining_heat, poi_density_heat, 
               transit_heat * 0.35 + dining_heat * 0.45 + poi_density_heat * 0.20, heat);
        heat
    }
    
    fn apply_sigmoid_scaling(&self, raw_heat: f64) -> f64 {
        // Use a sigmoid-like function to compress high values and spread mid-range values
        const SCALING_FACTOR: f64 = 2.5;
        const SHIFT: f64 = 0.4;
        
        let shifted = raw_heat - SHIFT;
        let scaled = shifted * SCALING_FACTOR;
        
        // Apply sigmoid function: 1 / (1 + e^(-x))
        let sigmoid = 1.0 / (1.0 + (-scaled).exp());
        
        let final_heat = if raw_heat < 0.1 {
            raw_heat * 2.0
        } else {
            (sigmoid - 0.5) * 1.8 + 0.1
        };
        
        final_heat.max(0.0).min(1.0)
    }

    fn calculate_transit_proximity_heat(&self, location: &Location, all_pois: &[PointOfInterest]) -> f64 {
        let transit_hubs: Vec<&PointOfInterest> = all_pois.iter()
            .filter(|poi| matches!(poi.poi_type, PoiType::TransitHub))
            .collect();
        
        if transit_hubs.is_empty() {
            return 0.0;
        }
        
        let mut total_heat = 0.0;
        const MAX_TRANSIT_DISTANCE: f64 = 800.0; // Reduced from 1km for more granular scoring
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
                
        if let Some(railway) = tags.get("railway") {
            match railway.as_str() {
                "station" => importance += 0.2,
                "subway_entrance" => importance += 0.15,
                _ => {}
            }
        }
        
        if let Some(public_transport) = tags.get("public_transport") {
            match public_transport.as_str() {
                "station" => importance += 0.2,
                "stop_position" => importance += 0.1,
                _ => {}
            }
        }
        
        // Cap importance at 1.0
        importance.min(1.0)
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
    tags: std::collections::HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
struct OverpassCenter {
    lat: f64,
    lon: f64,
} 