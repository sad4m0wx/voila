use reqwest;
use uuid::Uuid;
use futures::future::join_all;
use std::time::Duration;
use std::env;
use log::{debug, info, warn, error};
use anyhow::{Result, anyhow};
use geo::{Polygon, Coord, Area, Point};

use crate::models::isochrone::{
    IsochroneRequest, IsochroneResult, GraphHopperIsochroneResponse
};
use crate::models::Location;
use crate::services::cache_service::cache;


#[derive(Clone)]
pub struct IsochroneService {
    client: reqwest::Client,
    graphhopper_url: String,
}

impl IsochroneService {
    /// Create new isochrone service
    pub fn new() -> Self {
        let graphhopper_url = env::var("GRAPHHOPPER_URL")
            .unwrap_or_else(|_| "http://voila-app.fr:8989".to_string());
            
        let client = Client::builder()
            .timeout(Duration::from_secs(120)) // 2 minutes HTTP timeout for PT isochrones
            .pool_max_idle_per_host(10)        // Connection pooling
            .pool_idle_timeout(Duration::from_secs(60))
            .tcp_keepalive(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        info!("Isochrone service initialized with GraphHopper at: {}", graphhopper_url);

        Self { client, graphhopper_url }
    }

    /// Compute isochrone by calling GraphHopper API
    /// Note: Caching is handled by CacheService, not here
    pub async fn compute_isochrone(&self, request: &IsochroneRequest) -> Result<IsochroneResult> {
        let profile_being_used = request.profile.as_deref().unwrap_or("pt");
        
        // Use the unified isochrone endpoint with profile parameter
        let url = format!("{}/isochrone", self.graphhopper_url);
        info!("🌐 Using unified isochrone endpoint with profile '{}'", profile_being_used);
        
        let params = self.build_query_params(request);
        info!("🌐 Making isochrone request with profile '{}' to: {}", profile_being_used, url);
        debug!("Isochrone request parameters: {:?}", params);

        let response = match self.client
            .get(&url)
            .query(&params)
            .send()
            .await {
            Ok(resp) => resp,
            Err(e) => {
                error!("Failed to send isochrone request to GraphHopper: {}", e);
                return Err(anyhow!("Network error contacting GraphHopper: {}", e));
            }
        };

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            error!("GraphHopper isochrone API error: {} - {}", status, error_text);
            return Err(anyhow!("GraphHopper API error: {} - {}", status, error_text));
        }

        let response_text = match response.text().await {
            Ok(text) => {
                debug!("Isochrone response length: {} bytes", text.len());
                text
            }
            Err(e) => {
                error!("Failed to read isochrone response body: {}", e);
                return Err(anyhow!("Failed to read response: {}", e));
            }
        };
        
        let polygon = match self.parse_isochrone_response(&response_text) {
            Ok(poly) => poly,
            Err(e) => {
                error!("Failed to parse isochrone response: {}", e);
                debug!("Response text that failed parsing: {}", response_text);
                return Err(e);
            }
        };
        
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

        debug!("Successfully computed isochrone with {} exterior points", 
              result.polygon.exterior().coords().count());
        
        Ok(result)
    }

    /// Batch process multiple isochrone requests with timeout prevention
    pub async fn batch_isochrone_requests(
        locations: &[(String, Location)],
        time_limit: u32,
    ) -> Result<Vec<IsochroneResult>> {
        // Cap the time limit to prevent API timeouts (max 30 minutes)
        let capped_time_limit = time_limit.min(30 * 60);
        if time_limit > 1800 {
            info!("Time limit capped from {}min to {}min to prevent API timeouts", 
                  time_limit / 60, capped_time_limit / 60);
        }
        
        info!("Computing {} isochrones with {}min time limit", locations.len(), capped_time_limit / 60);
        
        // Try parallel processing first
        match Self::try_parallel_isochrones(locations, capped_time_limit).await {
            Ok(isochrones) => Ok(isochrones),
            Err(e) => {
                warn!("Parallel processing failed ({}), falling back to sequential with retries", e);
                Self::try_sequential_with_retries(locations, capped_time_limit).await
            }
        }
    }

    /// Try parallel isochrone processing (faster but more prone to timeouts)
    async fn try_parallel_isochrones(
        locations: &[(String, Location)],
        time_limit: u32,
    ) -> Result<Vec<IsochroneResult>> {
        let isochrone_service = IsochroneService::new();
        
        let timeout_duration = Duration::from_secs(90); // 90 second timeout per isochrone
        let isochrone_futures: Vec<_> = locations.iter().enumerate().map(|(i, (id, location))| {
            let request = IsochroneRequest {
                point: location.clone(),
                time_limit: Some(time_limit),
                distance_limit: None,
                profile: Some("pt".to_string()),
                buckets: Some(1),
                reverse_flow: Some(false),
            };
            let id = id.clone();
            let service = isochrone_service.clone();
            
            async move {
                info!("🚀 Parallel isochrone {} for '{}'", i + 1, id);
                let result = tokio::time::timeout(timeout_duration, service.compute_isochrone(&request)).await;
                
                match result {
                    Ok(Ok(iso)) => {
                        let area_km2 = iso.polygon.unsigned_area() * 111.0 * 111.0;
                        info!("✅ Isochrone {} SUCCESS: {:.2} km²", i + 1, area_km2);
                        Ok(iso)
                    }
                    Ok(Err(e)) => {
                        error!("❌ Isochrone {} FAILED: {}", i + 1, e);
                        Err(e)
                    }
                    Err(_) => {
                        error!("⏰ Isochrone {} TIMEOUT after 90s", i + 1);
                        Err(anyhow!("Timeout after 90 seconds"))
                    }
                }
            }
        }).collect();

        let results = join_all(isochrone_futures).await;
        let mut isochrones = Vec::new();
        let mut failed_count = 0;
        
        for result in results {
            match result {
                Ok(iso) => isochrones.push(iso),
                Err(_) => failed_count += 1,
            }
        }

        if isochrones.len() >= 2 {
            info!("✅ Parallel processing succeeded: {} isochrones", isochrones.len());
            Ok(isochrones)
        } else {
            Err(anyhow!("Too many parallel failures: {} succeeded, {} failed", isochrones.len(), failed_count))
        }
    }

    /// Sequential processing with retries and reduced time limits
    async fn try_sequential_with_retries(
        locations: &[(String, Location)],
        initial_time_limit: u32,
    ) -> Result<Vec<IsochroneResult>> {
        let isochrone_service = IsochroneService::new();
        let mut isochrones = Vec::new();
        
        for (i, (id, location)) in locations.iter().enumerate() {
            info!("🔄 Sequential isochrone {} for '{}' at ({:.6}, {:.6})", 
                  i + 1, id, location.latitude, location.longitude);
            
            // Try with progressively shorter time limits if needed
            let time_limits = [initial_time_limit, initial_time_limit / 2, 600]; // Original, half, 10min
            let mut success = false;
            
            for (attempt, &time_limit) in time_limits.iter().enumerate() {
                let request = IsochroneRequest {
                    point: location.clone(),
                    time_limit: Some(time_limit),
                    distance_limit: None,
                    profile: Some("pt".to_string()),
                    buckets: Some(1),
                    reverse_flow: Some(false),
                };
                
                let timeout_duration = Duration::from_secs(60); // 60 second timeout
                let result = tokio::time::timeout(timeout_duration, isochrone_service.compute_isochrone(&request)).await;
                
                match result {
                    Ok(Ok(iso)) => {
                        let area_km2 = iso.polygon.unsigned_area() * 111.0 * 111.0;
                        info!("✅ Isochrone {} SUCCESS (attempt {}, {}min): {:.2} km²", 
                              i + 1, attempt + 1, time_limit / 60, area_km2);
                        isochrones.push(iso);
                        success = true;
                        break;
                    }
                    Ok(Err(e)) => {
                        warn!("⚠️  Isochrone {} attempt {} failed: {}", i + 1, attempt + 1, e);
                    }
                    Err(_) => {
                        warn!("⏰ Isochrone {} attempt {} timeout ({}min)", i + 1, attempt + 1, time_limit / 60);
                    }
                }
            }
            
            if !success {
                error!("❌ Isochrone {} FAILED after all retries", i + 1);
            }
        }
        
        info!("🏁 Sequential processing result: {} succeeded out of {}", isochrones.len(), locations.len());
        
        if isochrones.is_empty() {
            return Err(anyhow!("All {} isochrone computations failed", locations.len()));
        }
        
        if isochrones.len() < locations.len() {
            warn!("⚠️  Only {} out of {} isochrones succeeded - algorithm will continue", 
                  isochrones.len(), locations.len());
        }

        Ok(isochrones)
    }

    /// Build query parameters for GraphHopper API
    fn build_query_params(&self, request: &IsochroneRequest) -> Vec<(&str, String)> {
        let profile = request.profile.as_deref().unwrap_or("pt");
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

        // Always add the profile parameter for the unified endpoint
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