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
    Restaurant,      // Restaurants, cafes, bars
    Shopping,        // Malls, markets, shops
    Entertainment,   // Cinemas, theaters, parks
    PublicSpace,     // Squares, plazas, landmarks
    Other(String),
}

impl PoiType {
    pub fn importance_weight(&self) -> f64 {
        match self {
            PoiType::TransitHub => 1.0,      // Highest priority - excellent for meetings
            PoiType::PublicSpace => 0.9,     // Public squares, landmarks
            PoiType::Restaurant => 0.8,      // Good meeting spots
            PoiType::Shopping => 0.7,        // Malls, markets
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

    /// Get POIs within intersection polygons, prioritizing transit hubs and meeting-friendly locations
    pub async fn get_pois_in_polygons(&self, polygons: &[Polygon<f64>]) -> Result<Vec<PointOfInterest>> {
        if polygons.is_empty() {
            return Ok(Vec::new());
        }

        // Calculate bounding box for all polygons
        let bbox = self.calculate_bounding_box(polygons);
        
        // Fetch POIs from Overpass API
        let mut all_pois = Vec::new();
        
        // Fetch different types of POIs in parallel
        let transit_pois = self.fetch_transit_hubs(&bbox).await?;
        let restaurant_pois = self.fetch_restaurants(&bbox).await?;
        let public_space_pois = self.fetch_public_spaces(&bbox).await?;
        
        all_pois.extend(transit_pois);
        all_pois.extend(restaurant_pois);
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

    async fn fetch_restaurants(&self, bbox: &BoundingBox) -> Result<Vec<PointOfInterest>> {
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

        self.execute_overpass_query(&query, PoiType::Restaurant).await
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
                PoiType::Restaurant => "Restaurant",
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

    fn calculate_poi_importance(&self, tags: &std::collections::HashMap<String, String>, poi_type: &PoiType) -> f64 {
        let mut importance = poi_type.importance_weight();
        
        // Boost importance based on specific tags
        if tags.contains_key("name") {
            importance += 0.1; // Named places are more important
        }
        
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