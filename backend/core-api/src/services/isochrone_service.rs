use anyhow::{anyhow, Result};
use geo::{Polygon, Coord};
use log::{info, error, debug};
use reqwest::Client;
use std::env;
use std::time::Duration;
use uuid::Uuid;

use crate::models::isochrone::{
    IsochroneRequest, IsochroneResult, GraphHopperIsochroneResponse
};
use crate::models::location::Location;

pub struct IsochroneService {
    client: Client,
    graphhopper_url: String,
}

impl IsochroneService {
    /// Create new isochrone service
    pub fn new() -> Self {
        let graphhopper_url = env::var("GRAPHHOPPER_URL")
            .unwrap_or_else(|_| "http://voila-app.fr:8989".to_string());
            
        let client = Client::builder()
            .timeout(Duration::from_secs(45))
            .build()
            .expect("Failed to create HTTP client");

        info!("Isochrone service initialized with GraphHopper at: {}", graphhopper_url);

        Self { client, graphhopper_url }
    }

    /// Compute isochrone by calling GraphHopper API
    /// Note: Caching is handled by CacheService, not here
    pub async fn compute_isochrone(&self, request: &IsochroneRequest) -> Result<IsochroneResult> {
        info!("Computing isochrone for location: ({}, {})", 
              request.point.latitude, request.point.longitude);
        
        let params = self.build_query_params(request);
        let url = format!("{}/isochrone", self.graphhopper_url);
        
        debug!("Making isochrone request to: {} with params: {:?}", url, params);

        let response = self.client
            .get(&url)
            .query(&params)
            .send()
            .await?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            error!("GraphHopper isochrone API error: {} - {}", status, error_text);
            return Err(anyhow!("GraphHopper API error: {} - {}", status, error_text));
        }

        let response_text = response.text().await?;
        debug!("Isochrone response length: {} bytes", response_text.len());
        
        let polygon = self.parse_isochrone_response(&response_text)?;
        let profile = request.profile.as_deref().unwrap_or("pt");
        
        let result = IsochroneResult {
            id: Uuid::new_v4().to_string(),
            location: request.point.clone(),
            time_limit_seconds: request.time_limit.unwrap_or(600),
            profile: profile.to_string(),
            polygon,
            created_at: chrono::Utc::now(),
            bucket: 0,
        };

        info!("Successfully computed isochrone with {} exterior points", 
              result.polygon.exterior().coords().count());
        
        Ok(result)
    }

    /// Create a geometric fallback isochrone when GraphHopper fails
    pub fn create_geometric_fallback(
        &self, 
        location: &Location, 
        time_limit_seconds: u32, 
        profile: &str
    ) -> IsochroneResult {
        info!("Creating geometric fallback isochrone for location: ({}, {})", 
              location.latitude, location.longitude);
        
        // Estimate radius based on profile and time
        let radius_km = match profile {
            "foot" | "walking" => (time_limit_seconds as f64 / 3600.0) * 5.0, // 5 km/h
            "bike" | "cycling" => (time_limit_seconds as f64 / 3600.0) * 15.0, // 15 km/h
            "car" => (time_limit_seconds as f64 / 3600.0) * 50.0, // 50 km/h in city
            "pt" | "public_transport" => (time_limit_seconds as f64 / 3600.0) * 20.0, // 20 km/h
            _ => (time_limit_seconds as f64 / 3600.0) * 30.0, // Default 30 km/h
        };
        
        let radius_degrees = radius_km / 111.32; // Rough conversion: 1 degree ≈ 111.32 km
        
        // Create a circular polygon
        let center_lat = location.latitude;
        let center_lng = location.longitude;
        
        let mut coords = Vec::new();
        let num_points = 16; // Simpler circle with fewer points
        
        for i in 0..num_points {
            let angle = 2.0 * std::f64::consts::PI * (i as f64) / (num_points as f64);
            let lat = center_lat + radius_degrees * angle.cos();
            let lng = center_lng + radius_degrees * angle.sin() / center_lat.to_radians().cos();
            coords.push(Coord { x: lng, y: lat });
        }
        
        // Close the polygon
        coords.push(coords[0]);
        
        let polygon = Polygon::new(geo::LineString::from(coords), vec![]);
        
        info!("Created geometric fallback with radius {:.2} km", radius_km);
        
        IsochroneResult {
            id: Uuid::new_v4().to_string(),
            location: location.clone(),
            time_limit_seconds,
            profile: profile.to_string(),
            polygon,
            created_at: chrono::Utc::now(),
            bucket: 0,
        }
    }

    /// Build query parameters for GraphHopper API
    fn build_query_params(&self, request: &IsochroneRequest) -> Vec<(&str, String)> {
        let mut params = vec![
            ("point", format!("{},{}", request.point.latitude, request.point.longitude)),
            ("buckets", request.buckets.unwrap_or(1).to_string()),
            ("reverse_flow", request.reverse_flow.unwrap_or(false).to_string()),
        ];

        // Add time or distance limit
        if let Some(time_limit) = request.time_limit {
            params.push(("time_limit", time_limit.to_string()));
        } else if let Some(distance_limit) = request.distance_limit {
            params.push(("distance_limit", distance_limit.to_string()));
        } else {
            params.push(("time_limit", "600".to_string()));
        }

        // Add profile
        let profile = request.profile.as_deref().unwrap_or("pt");
        params.push(("profile", profile.to_string()));

        // Add departure time for public transport profiles
        if profile == "pt" || profile == "public_transport" {
            let today = chrono::Utc::now().date_naive();
            let departure_time = today
                .and_hms_opt(12, 0, 0)
                .unwrap()
                .and_utc()
                .format("%Y-%m-%dT%H:%M:%SZ")
                .to_string();
            params.push(("pt.earliest_departure_time", departure_time));
        }

        params
    }

    /// Parse GraphHopper isochrone response into a polygon
    fn parse_isochrone_response(&self, response_text: &str) -> Result<Polygon<f64>> {
        debug!("Parsing isochrone response of {} bytes", response_text.len());
        
        let response: GraphHopperIsochroneResponse = serde_json::from_str(response_text)
            .map_err(|e| anyhow!("Failed to parse isochrone response: {}", e))?;
        
        if response.polygons.is_empty() {
            return Err(anyhow!("No isochrone polygons returned"));
        }
        
        // Take the first polygon (or the one with lowest bucket for multiple buckets)
        let target_polygon = response.polygons
            .iter()
            .min_by_key(|p| p.properties.bucket)
            .unwrap_or(&response.polygons[0]);
        
        debug!("Using polygon with bucket: {}", target_polygon.properties.bucket);
        
        // Convert coordinates to geo::Polygon
        if !target_polygon.geometry.coordinates.is_empty() {
            let polygon_rings = &target_polygon.geometry.coordinates;
            
            if let Some(rings) = polygon_rings.first() {
                if let Some(exterior_coords) = rings.first() {
                    // Convert coordinates
                    let exterior: Vec<Coord<f64>> = exterior_coords
                        .iter()
                        .map(|coord| Coord { x: coord[0], y: coord[1] })
                        .collect();
                    
                    // Handle interior rings (holes) if any
                    let interiors: Vec<geo::LineString<f64>> = rings
                        .iter()
                        .skip(1) // Skip the exterior ring
                        .take(5) // Limit interior rings for simplicity
                        .map(|interior_coords| {
                            let interior: Vec<Coord<f64>> = interior_coords
                                .iter()
                                .map(|coord| Coord { x: coord[0], y: coord[1] })
                                .collect();
                            geo::LineString::from(interior)
                        })
                        .collect();
                    
                    let polygon = Polygon::new(geo::LineString::from(exterior), interiors.clone());
                    info!("Successfully created polygon with {} exterior points and {} interior rings", 
                          exterior_coords.len(), interiors.len());
                    return Ok(polygon);
                }
            }
        }
        
        Err(anyhow!("No valid coordinates found in polygon"))
    }
}

impl Default for IsochroneService {
    fn default() -> Self {
        Self::new()
    }
}