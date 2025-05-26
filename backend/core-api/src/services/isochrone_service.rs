use anyhow::{anyhow, Result};
use geo::{Polygon, Coord};
use log::{info, warn, error, debug};
use reqwest::Client;
use std::env;
use std::time::Duration;
use uuid::Uuid;
use std::sync::Arc;
use tokio::sync::Semaphore;
use once_cell::sync::Lazy;

use crate::models::isochrone::{
    IsochroneRequest, IsochroneResult, GraphHopperIsochroneResponse
};
use crate::models::location::Location;
use crate::services::redis_client::RedisClient;

// Limit concurrent isochrone requests to prevent overwhelming GraphHopper
static ISOCHRONE_SEMAPHORE: Lazy<Semaphore> = Lazy::new(|| Semaphore::new(10));

pub struct IsochroneService {
    client: Client,
    graphhopper_url: String,
    redis: Arc<RedisClient>,
}

impl IsochroneService {
    pub fn new() -> Self {
        let graphhopper_url = env::var("GRAPHHOPPER_URL")
            .unwrap_or_else(|_| "http://voila-app.fr:8989".to_string());
            
        let client = Client::builder()
            .timeout(Duration::from_secs(45))
            .pool_max_idle_per_host(20)
            .pool_idle_timeout(Duration::from_secs(90))
            .tcp_keepalive(Duration::from_secs(60))
            .build()
            .expect("Failed to create HTTP client");

        let redis = Arc::new(RedisClient::new().unwrap_or_else(|_| {
            warn!("Failed to create Redis client, caching disabled");
            RedisClient::new().unwrap()
        }));

        Self { client, graphhopper_url, redis }
    }

    /// Generate cache key for isochrone request
    fn generate_cache_key(&self, request: &IsochroneRequest) -> String {
        let profile = request.profile.as_deref().unwrap_or("pt");
        let time_limit = request.time_limit.unwrap_or(600);
        format!(
            "isochrone:{}:{}:{}:{}",
            profile,
            request.point.latitude,
            request.point.longitude,
            time_limit
        )
    }

    /// Compute isochrone for a given location and parameters
    pub async fn compute_isochrone(&self, request: &IsochroneRequest) -> Result<IsochroneResult> {
        // Check cache first
        let cache_key = self.generate_cache_key(request);
        if let Some(cached_result) = self.redis.get::<IsochroneResult>(&cache_key).await {
            info!("Cache hit for isochrone: {}", cache_key);
            return Ok(cached_result);
        }

        info!("Computing isochrone for location: {:?}", request.point);
        
        // Acquire semaphore to limit concurrent requests
        let _permit = ISOCHRONE_SEMAPHORE.acquire().await.expect("Semaphore closed");
        
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
            return Err(anyhow!("GraphHopper isochrone API error: {} - {}", status, error_text));
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
        
        // Cache the result for 1 hour
        if let Err(e) = self.redis.set(&cache_key, &result, 3600).await {
            warn!("Failed to cache isochrone result: {}", e);
        }
        
        Ok(result)
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

    /// Parse GraphHopper isochrone response
    fn parse_isochrone_response(&self, response_text: &str) -> Result<Polygon<f64>> {
        debug!("Parsing isochrone response of {} bytes", response_text.len());
        
        // Parse as GraphHopper format
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
        // GraphHopper returns coordinates as [[[[ring1]]], [[[ring2]]]], where ring1 is exterior, others are holes
        if !target_polygon.geometry.coordinates.is_empty() {
            let polygon_rings = &target_polygon.geometry.coordinates;
            
            if let Some(rings) = polygon_rings.first() {
                if let Some(exterior_coords) = rings.first() {
                    // Simplify polygon if it has too many points (performance optimization)
                    let simplified_exterior = if exterior_coords.len() > 500 {
                        warn!("Large polygon with {} points, simplifying for performance", exterior_coords.len());
                        Self::simplify_coordinates(exterior_coords, 0.001) // ~100m tolerance
                    } else {
                        exterior_coords.clone()
                    };
                    
                    let exterior: Vec<Coord<f64>> = simplified_exterior
                        .iter()
                        .map(|coord| Coord { x: coord[0], y: coord[1] })
                        .collect();
                    
                    // Handle interior rings (holes) if any - also simplify them
                    let interiors: Vec<geo::LineString<f64>> = rings
                        .iter()
                        .skip(1) // Skip the exterior ring
                        .take(10) // Limit to 10 interior rings for performance
                        .map(|interior_coords| {
                            let simplified_interior = if interior_coords.len() > 100 {
                                Self::simplify_coordinates(interior_coords, 0.002) // Larger tolerance for holes
                            } else {
                                interior_coords.clone()
                            };
                            
                            let interior: Vec<Coord<f64>> = simplified_interior
                                .iter()
                                .map(|coord| Coord { x: coord[0], y: coord[1] })
                                .collect();
                            geo::LineString::from(interior)
                        })
                        .collect();
                    
                    let num_interiors = interiors.len();
                    let polygon = Polygon::new(geo::LineString::from(exterior), interiors);
                    info!("Successfully created polygon with {} exterior points and {} interior rings", 
                          simplified_exterior.len(), num_interiors);
                    return Ok(polygon);
                }
            }
        }
        
        Err(anyhow!("No exterior coordinates found in polygon"))
    }

    /// Simplify coordinate array using Douglas-Peucker-like algorithm
    fn simplify_coordinates(coords: &[[f64; 2]], tolerance: f64) -> Vec<[f64; 2]> {
        if coords.len() <= 3 {
            return coords.to_vec();
        }
        
        // Simple decimation: keep every nth point based on tolerance
        let step = std::cmp::max(1, (coords.len() as f64 * tolerance * 10.0) as usize);
        let mut simplified = Vec::new();
        
        // Always keep first point
        simplified.push(coords[0]);
        
        // Keep every step-th point
        for i in (step..coords.len()).step_by(step) {
            simplified.push(coords[i]);
        }
        
        // Always keep last point (to close polygon)
        if let Some(last) = coords.last() {
            if simplified.last() != Some(last) {
                simplified.push(*last);
            }
        }
        
        simplified
    }

    /// Create a simple geometric isochrone as fallback
    pub fn create_geometric_fallback(&self, location: &Location, time_limit_seconds: u32, profile: &str) -> IsochroneResult {
        info!("Creating geometric fallback isochrone for location: {:?}", location);
        
        // Estimate radius based on profile and time
        let radius_km = match profile {
            "foot" | "walking" => (time_limit_seconds as f64 / 3600.0) * 5.0, // 5 km/h walking
            "bike" | "cycling" => (time_limit_seconds as f64 / 3600.0) * 15.0, // 15 km/h cycling
            "car" => (time_limit_seconds as f64 / 3600.0) * 50.0, // 50 km/h in city
            "pt" | "public_transport" => (time_limit_seconds as f64 / 3600.0) * 20.0, // 20 km/h average
            _ => (time_limit_seconds as f64 / 3600.0) * 30.0, // Default 30 km/h
        };
        
        let radius_degrees = radius_km / 111.32; // Rough conversion: 1 degree ≈ 111.32 km
        
        // Create a circular polygon
        let center_lat = location.latitude;
        let center_lng = location.longitude;
        
        let mut coords = Vec::new();
        let num_points = 32; // Number of points to approximate the circle
        
        for i in 0..num_points {
            let angle = 2.0 * std::f64::consts::PI * (i as f64) / (num_points as f64);
            let lat = center_lat + radius_degrees * angle.cos();
            let lng = center_lng + radius_degrees * angle.sin() / center_lat.to_radians().cos();
            coords.push(Coord { x: lng, y: lat });
        }
        
        // Close the polygon
        coords.push(coords[0]);
        
        let polygon = Polygon::new(geo::LineString::from(coords), vec![]);
        
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

    /// Get isochrone with fallback to geometric approximation
    pub async fn get_isochrone_with_fallback(&self, request: &IsochroneRequest) -> IsochroneResult {
        match self.compute_isochrone(request).await {
            Ok(result) => {
                info!("Successfully computed isochrone via GraphHopper API");
                result
            }
            Err(e) => {
                warn!("Failed to compute isochrone via GraphHopper: {}, using geometric fallback", e);
                let profile = request.profile.as_deref().unwrap_or("pt");
                let time_limit = request.time_limit.unwrap_or(600);
                self.create_geometric_fallback(&request.point, time_limit, profile)
            }
        }
    }
} 