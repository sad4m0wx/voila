use reqwest::Client;
use uuid::Uuid;
use futures::future::join_all;
use std::time::Duration;
use std::env;
use log::{debug, info, warn, error};
use anyhow::{Result, anyhow};
use geo::{Polygon, Coord, BooleanOps, Area, HasDimensions};

use crate::models::isochrone::{
    IsochroneRequest, IsochroneResult, GraphHopperIsochroneResponse
};
use crate::models::Location;
use crate::services::cache_service::{CacheService};
use crate::routes::meeting_point::CACHE_TTL_SECONDS;

#[derive(Clone)]
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
            .timeout(Duration::from_secs(120)) // 2 minutes HTTP timeout for PT isochrones
            .pool_max_idle_per_host(10)        // Connection pooling
            .pool_idle_timeout(Duration::from_secs(60))
            .tcp_keepalive(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        info!("Isochrone service initialized with GraphHopper at: {}", graphhopper_url);

        Self { client, graphhopper_url }
    }

    pub async fn get_isochrone(&self, request: &IsochroneRequest) -> Result<IsochroneResult> {
        let cache_service = CacheService::cache().await;
        let time_limit = request.time_limit.unwrap_or(30);
        let profile = request.profile.as_deref().unwrap_or("pt");

        if let Some(cached) = cache_service.get_cached_isochrone(&request.point, time_limit, profile).await {
            let area_km2 = cached.polygon.unsigned_area() * 111.0 * 111.0;
            info!("✅ Isochrone cache hit - area: {:.2} km²", area_km2);
            return Ok(cached);
        }
        
        // Try to acquire lock for computation
        if !cache_service.acquire_isochrone_lock(&request.point, time_limit, profile).await {
            info!("🔒 Another request is computing this isochrone, waiting...");
            
            // Wait up to 60 seconds for the other computation to complete
            for i in 0..60 {
                tokio::time::sleep(Duration::from_secs(1)).await;
                
                // Check cache again
                if let Some(cached) = cache_service.get_cached_isochrone(&request.point, time_limit, profile).await {
                    let area_km2 = cached.polygon.unsigned_area() * 111.0 * 111.0;
                    info!("✅ Got result from concurrent computation - area: {:.2} km²", area_km2);
                    return Ok(cached);
                }
                
                // Check if we should give up waiting (every 10 seconds)
                if i > 0 && i % 10 == 0 {
                    if !cache_service.is_isochrone_computing(&request.point, time_limit, profile).await {
                        info!("🔒 Lock disappeared, other computation may have failed");
                        break;
                    }
                    info!("🔒 Still waiting for concurrent computation... ({}s)", i);
                }
            }
            
            // If we're here, either timeout or the other computation failed
            info!("⚠️ Timeout or failed concurrent computation, computing ourselves");
            
            // Try to acquire lock again (the other computation might have failed)
            if !cache_service.acquire_isochrone_lock(&request.point, time_limit, profile).await {
                // If still can't acquire lock, proceed without it as last resort
                warn!("🔒 Still can't acquire lock, proceeding without lock protection");
            }
        }
        
        info!("🚀 Starting isochrone computation");
        
        // Compute new isochrone
        let result = match self.compute_isochrone(request).await {
            Ok(r) => r,
            Err(e) => {
                // Make sure to release lock on error
                cache_service.release_isochrone_lock(&request.point, time_limit, profile).await;
                return Err(e);
            }
        };
        
        let area_km2 = result.polygon.unsigned_area() * 111.0 * 111.0;
        info!("🆕 Computed new isochrone - area: {:.2} km²", area_km2);
        
        if area_km2 < 0.01 {
            warn!("⚠️  Very small isochrone area detected: {:.6} km² - this might indicate an issue", area_km2);
        }

        // Cache the result
        match cache_service.cache_isochrone(&request.point, time_limit, profile, &result, Some(CACHE_TTL_SECONDS)).await {
            Ok(_) => info!("✅ Isochrone caching succeeded"),
            Err(e) => error!("❌ Isochrone caching failed: {}", e),
        }

        // Release the computation lock
        cache_service.release_isochrone_lock(&request.point, time_limit, profile).await;

        info!("✅ Isochrone computed successfully");
        Ok(result)
    }

    /// Get multiple isochrones with parallel processing and retries
    pub async fn get_isochrones(
        &self,
        locations: &[(String, Location)],
        time_limit_minutes: u32,
        profile: Option<String>,
    ) -> Result<Vec<IsochroneResult>> {

        let capped_time_limit = time_limit_minutes.min(90);
        if time_limit_minutes > 90 {
            info!("Time limit capped from {}min to {}min ", 
                  time_limit_minutes, capped_time_limit);
        }

        info!("🚀 Starting isochrone computation for {} locations with {}min time limit", 
              locations.len(), capped_time_limit);
        
        for (i, (id, location)) in locations.iter().enumerate() {
            info!("  Location {}: {} at ({:.6}, {:.6})", 
                  i+1, id, location.latitude, location.longitude);
        }
        
        // Try parallel processing first
        match self.try_parallel_isochrones(locations, capped_time_limit, &profile).await {
            Ok(isochrones) => {
                info!("✅ Parallel isochrone processing succeeded: {} isochrones", isochrones.len());
                Ok(isochrones)
            },
            Err(e) => {
                warn!("Parallel processing failed ({}), falling back to sequential with retries", e);
                self.try_sequential_with_retries(locations, capped_time_limit, &profile).await
            }
        }
    }

    /// Try parallel isochrone processing (faster but more prone to timeouts)
    async fn try_parallel_isochrones(
        &self,
        locations: &[(String, Location)],
        time_limit: u32,
        profile: &Option<String>,
    ) -> Result<Vec<IsochroneResult>> {
        let timeout_duration = Duration::from_secs(90); // 90 second timeout per isochrone
        let isochrone_futures: Vec<_> = locations.iter().enumerate().map(|(i, (id, location))| {
            let request = IsochroneRequest {
                point: location.clone(),
                time_limit: Some(time_limit),
                distance_limit: None,
                profile: profile.clone(),
                buckets: Some(1),
                reverse_flow: Some(false),
            };
            let id = id.clone();
            let service = self.clone();
            
            async move {
                info!("🚀 Parallel isochrone {} for '{}'", i + 1, id);
                let result = tokio::time::timeout(timeout_duration, service.get_isochrone(&request)).await;
                
                match result {
                    Ok(Ok(iso)) => {
                        let area_km2 = iso.polygon.signed_area().abs() * 111.0 * 111.0;
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
        &self,
        locations: &[(String, Location)],
        initial_time_limit: u32,
        profile: &Option<String>,
    ) -> Result<Vec<IsochroneResult>> {
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
                    profile: profile.clone(),
                    buckets: Some(1),
                    reverse_flow: Some(false),
                    
                };
                
                let timeout_duration = Duration::from_secs(60); // 60 second timeout
                let result = tokio::time::timeout(timeout_duration, self.get_isochrone(&request)).await;
                
                match result {
                    Ok(Ok(iso)) => {
                        let area_km2 = iso.polygon.signed_area().abs() * 111.0 * 111.0;
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

    /// Compute isochrone by calling GraphHopper API
    async fn compute_isochrone(&self, request: &IsochroneRequest) -> Result<IsochroneResult> {
        let profile = request.profile.as_deref().unwrap_or("pt");
        
        // Use the unified isochrone endpoint with profile parameter
        let url = format!("{}/isochrone", self.graphhopper_url);
        info!("🌐 Using unified isochrone endpoint with profile '{}'", profile);
        
        let params = self.build_query_params(request);
        let full_url = format!("{}?{}", url, params.iter()
            .map(|(k, v)| format!("{}={}", k, v))
            .collect::<Vec<_>>()
            .join("&"));
        info!("📋 Full isochrone request URL: {}", full_url);

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
        info!("📡 GraphHopper response status: {}", status);
        
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
            time_limit_minutes: request.time_limit.unwrap_or(600),
            profile: profile.to_string(),
            polygon,
            created_at: chrono::Utc::now(),
            bucket: 0,
        };

        debug!("Successfully computed isochrone with {} exterior points", 
              result.polygon.exterior().coords().count());
        
        Ok(result)
    }

    fn build_query_params(&self, request: &IsochroneRequest) -> Vec<(&str, String)> {
        let profile = request.profile.as_deref().unwrap_or("pt");
        let mut params = vec![
            ("point", format!("{},{}", request.point.latitude, request.point.longitude)),
            ("buckets", request.buckets.unwrap_or(1).to_string()),
            ("reverse_flow", request.reverse_flow.unwrap_or(false).to_string()),
        ];

        // Add time or distance limit
        if let Some(time_limit) = request.time_limit {
            params.push(("time_limit", (time_limit*60).to_string()));
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
                .to_rfc3339();
        
            params.push(("pt.earliest_departure_time", departure_time));
        }

        params
    }

    /// Parse GraphHopper isochrone response into a polygon
    fn parse_isochrone_response(&self, response_text: &str) -> Result<Polygon<f64>> {
        debug!("Parsing isochrone response of {} bytes", response_text.len());
        
        if response_text.len() < 500 {
            warn!("Short/suspicious isochrone response ({}bytes): '{}'", response_text.len(), response_text);
        }
        
        let response: GraphHopperIsochroneResponse = serde_json::from_str(response_text)
            .map_err(|e| anyhow!("Failed to parse isochrone response: {}", e))?;
        
        debug!("GraphHopper response contains {} polygons", response.polygons.len());
        
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
            debug!("Polygon has {} rings", polygon_rings.len());
            
            if let Some(rings) = polygon_rings.first() {
                debug!("First ring has {} sub-rings", rings.len());
                
                if let Some(exterior_coords) = rings.first() {
                    debug!("Exterior ring has {} coordinates", exterior_coords.len());
                    
                    if exterior_coords.len() < 3 {
                        return Err(anyhow!("Exterior ring has only {} coordinates (need at least 3)", exterior_coords.len()));
                    }
                    
                    // Convert coordinates - handle Vec<f64> format
                    let exterior: Vec<Coord<f64>> = exterior_coords
                        .iter()
                        .filter_map(|coord| {
                            if coord.len() >= 2 {
                                Some(Coord { x: coord[0], y: coord[1] })
                            } else {
                                warn!("Invalid coordinate with {} values: {:?}", coord.len(), coord);
                                None
                            }
                        })
                        .collect();
                    
                    // Handle interior rings (holes) if any
                    let interiors: Vec<geo::LineString<f64>> = rings
                        .iter()
                        .skip(1) // Skip the exterior ring
                        .take(5) // Limit interior rings for simplicity
                        .map(|interior_coords| {
                            let interior: Vec<Coord<f64>> = interior_coords
                                .iter()
                                .filter_map(|coord| {
                                    if coord.len() >= 2 {
                                        Some(Coord { x: coord[0], y: coord[1] })
                                    } else {
                                        warn!("Invalid interior coordinate: {:?}", coord);
                                        None
                                    }
                                })
                                .collect();
                            geo::LineString::from(interior)
                        })
                        .collect();
                    
                    let polygon = Polygon::new(geo::LineString::from(exterior), interiors.clone());
                    let area_deg2 = polygon.unsigned_area();
                    let area_km2 = area_deg2 * 111.0 * 111.0;
                    
                    info!("Successfully created polygon with {} exterior points and {} interior rings, area: {:.6} km²", 
                          exterior_coords.len(), interiors.len(), area_km2);
                    
                    if area_km2 < 0.01 {
                        warn!("⚠️  Very small polygon created: {:.6} km² - investigating coordinates", area_km2);
                        if !exterior_coords.is_empty() {
                            let first = &exterior_coords[0];
                            let last = &exterior_coords[exterior_coords.len()-1];
                            if first.len() >= 2 && last.len() >= 2 {
                                warn!("Sample coordinates: ({:.6}, {:.6}) to ({:.6}, {:.6})", 
                                       first[0], first[1], last[0], last[1]);
                            }
                            warn!("All first 5 coordinates: {:?}", 
                                   exterior_coords.iter().take(5).collect::<Vec<_>>());
                        }
                    }
                    
                    return Ok(polygon);
                }
            }
        }
        
        Err(anyhow!("No valid coordinates found in polygon"))
    }

    /// Compute intersections of multiple isochrones
    pub fn get_isochrone_intersections(&self, isochrones: &[IsochroneResult]) -> Vec<Polygon<f64>> {
        if isochrones.is_empty() {
            return Vec::new();
        }
        
        if isochrones.len() == 1 {
            // With only one isochrone, return it as-is
            return vec![isochrones[0].polygon.clone()];
        }
        
        // Start with the first isochrone and intersect with all others
        let mut current_intersection = isochrones[0].polygon.clone();
        info!("🔍 Starting intersection with first isochrone area: {:.4} km²", 
              current_intersection.unsigned_area() * 111.0 * 111.0);
        
        for isochrone in isochrones.iter().skip(1) {
            let _before_area = current_intersection.unsigned_area() * 111.0 * 111.0;
            let _other_area = isochrone.polygon.unsigned_area() * 111.0 * 111.0;
            
            let intersection_result = current_intersection.intersection(&isochrone.polygon);
                        
            if intersection_result.is_empty() {
                return Vec::new();
            }
            
            // For the next iteration, we need to work with individual polygons
            // Take the largest polygon from the intersection result
            if let Some(largest_polygon) = intersection_result.into_iter()
                .max_by(|a, b| a.unsigned_area().partial_cmp(&b.unsigned_area()).unwrap()) {
                current_intersection = largest_polygon;
            } else {
                info!("❌ No valid intersection polygons found");
                return Vec::new();
            }
        }
        
        let intersection_area_deg2 = current_intersection.unsigned_area();
        
        let min_area = 0.000005; // ~0.5m² in degrees, very permissive 
        if intersection_area_deg2 < min_area {
            return Vec::new();
        }
        
        vec![current_intersection]
    }

    
}

impl Default for IsochroneService {
    fn default() -> Self {
        Self::new()
    }
}