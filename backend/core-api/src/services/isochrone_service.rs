use reqwest::Client;
use std::time::Duration;
use std::env;
use log::{debug, info, warn, error};
use anyhow::{Result, anyhow};
use geo::{Polygon, Coord, LineString, Area, HasDimensions, BooleanOps};
use serde_json::{Value, json};
use futures::future::join_all;

use crate::models::isochrone::{IsochroneRequest, IsochroneResult};
use crate::models::Location;
use crate::services::cache_service::{CacheService, CACHE_TTL_SECONDS};

#[derive(Clone)]
pub struct IsochroneService {
    client: Client,
    valhalla_url: String,
}

impl IsochroneService {
    pub fn new() -> Self {
        let valhalla_url = env::var("VALHALLA_URL")
            .unwrap_or_else(|_| "http://voila-app.fr:8002".to_string());
            
        let client = Client::builder()
            .timeout(Duration::from_secs(120))
            .pool_max_idle_per_host(10)
            .pool_idle_timeout(Duration::from_secs(60))
            .tcp_keepalive(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        info!("Valhalla isochrone service initialized with endpoint: {}", valhalla_url);

        Self { 
            client, 
            valhalla_url,
        }
    }

    pub async fn get_isochrone(&self, request: &IsochroneRequest) -> Result<IsochroneResult> {
        let cache_service = CacheService::global().await;
        let time_limit = request.time_limit.unwrap_or(30);
        let profile = request.profile.as_deref().unwrap_or("pedestrian");

        // Round coordinates to 5 decimal places for caching
        let rounded_lat = (request.point.latitude * 100000.0).round() / 100000.0;
        let rounded_lon = (request.point.longitude * 100000.0).round() / 100000.0;
        let rounded_point = Location {
            latitude: rounded_lat,
            longitude: rounded_lon,
            address: None,
            place_id: None,
        };

        // Use "valhalla" as cache key suffix to distinguish from GraphHopper cache
        let cache_key_profile = format!("valhalla_{}", profile);

        // Check cache first
        if let Some(cached) = cache_service.get_cached_isochrone(&rounded_point, time_limit, &cache_key_profile).await {
            info!("✅ Valhalla isochrone cache hit");
            return Ok(cached);
        }

        // Try to acquire lock for computation
        if !cache_service.acquire_isochrone_lock(&rounded_point, time_limit, &cache_key_profile).await {
            info!("🔒 Another request is computing this isochrone, waiting...");
            
            // Wait up to 60 seconds for the other computation to complete
            for i in 0..60 {
                tokio::time::sleep(Duration::from_secs(1)).await;
                
                if let Some(cached) = cache_service.get_cached_isochrone(&rounded_point, time_limit, &cache_key_profile).await {
                    info!("✅ Got result from concurrent computation");
                    return Ok(cached);
                }
                
                if i > 0 && i % 10 == 0 {
                    if !cache_service.is_isochrone_computing(&rounded_point, time_limit, &cache_key_profile).await {
                        break;
                    }
                    info!("🔒 Still waiting for concurrent computation... ({}s)", i);
                }
            }
        }

        info!("🚀 Starting Valhalla isochrone computation");

        // Compute new isochrone using Valhalla
        let result = match self.compute_isochrone(request).await {
            Ok(r) => r,
            Err(e) => {
                cache_service.release_isochrone_lock(&rounded_point, time_limit, &cache_key_profile).await;
                return Err(e);
            }
        };

        info!("🆕 Computed new Valhalla isochrone");

        // Cache the result
        match cache_service.cache_isochrone(&rounded_point, time_limit, &cache_key_profile, &result, Some(CACHE_TTL_SECONDS)).await {
            Ok(_) => info!("✅ Valhalla isochrone caching succeeded"),
            Err(e) => error!("❌ Valhalla isochrone caching failed: {}", e),
        }

        // Release the computation lock
        cache_service.release_isochrone_lock(&rounded_point, time_limit, &cache_key_profile).await;

        Ok(result)
    }

    pub async fn get_isochrones(
        &self,
        locations: &[(String, Location)],
        time_limit_minutes: u32,
        profile: Option<String>,
    ) -> Result<Vec<IsochroneResult>> {

        let capped_time_limit = time_limit_minutes.min(90);
        let cache_service = CacheService::global().await; 

        info!("🚀 Starting Valhalla isochrone computation for {} locations with {}min time limit", locations.len(), capped_time_limit);
        
        let profile_str = profile.as_deref().unwrap_or("pedestrian");
        let cache_key_profile = format!("valhalla_{}", profile_str);
        
        let cached_results = cache_service.get_cached_isochrones(locations, capped_time_limit, &cache_key_profile).await;

        let cache_hits = cached_results.iter().filter(|r| r.is_some()).count();
        info!("🎯 Cache hit for {} out of {} Valhalla isochrones", cache_hits, locations.len());

        // Compute missing isochrones in parallel
        let timeout_duration = Duration::from_secs(90);
        let isochrone_futures: Vec<_> = locations.iter().enumerate()
            .zip(cached_results.iter())
            .filter_map(|((i, (id, location)), cached)| {
                if cached.is_some() {
                    None
                } else {
                    let request = IsochroneRequest {
                        point: location.clone(),
                        time_limit: Some(capped_time_limit),
                        distance_limit: None,
                        profile: Some(profile_str.to_string()),
                        buckets: Some(1),
                        reverse_flow: Some(false),
                    };
                    let id = id.clone();
                    let service = self.clone();
                    
                    Some(async move {
                        info!("🚀 Computing Valhalla isochrone {} for '{}'", i + 1, id);
                        let result = tokio::time::timeout(timeout_duration, service.get_isochrone(&request)).await;
                        
                        match result {
                            Ok(Ok(iso)) => {
                                let area_km2 = iso.polygon.signed_area().abs() * 111.0 * 111.0;
                                info!("✅ Valhalla isochrone {} SUCCESS: {:.2} km²", i + 1, area_km2);
                                (i, Some(iso))
                            }
                            Ok(Err(e)) => {
                                error!("❌ Valhalla isochrone {} FAILED: {}", i + 1, e);
                                (i, None)
                            }
                            Err(_) => {
                                error!("⏰ Valhalla isochrone {} TIMEOUT after 90s", i + 1);
                                (i, None)
                            }
                        }
                    })
                }
            }).collect();

        let computation_results = join_all(isochrone_futures).await;

        let mut final_results = cached_results;
        for (index, computed_result) in computation_results {
            if let Some(iso) = computed_result {
                final_results[index] = Some(iso);
            }
        }

        let mut isochrones: Vec<IsochroneResult> = final_results.into_iter()
            .filter_map(|r| r)
            .collect();

        // Sort isochrones by location coordinates for deterministic ordering
        isochrones.sort_by(|a, b| {
            a.location.latitude.partial_cmp(&b.location.latitude)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| a.location.longitude.partial_cmp(&b.location.longitude)
                    .unwrap_or(std::cmp::Ordering::Equal))
        });

        let success_count = isochrones.len();
        info!("🏁 Final Valhalla result: {} out of {} isochrones succeeded", success_count, locations.len());

        if isochrones.is_empty() {
            return Err(anyhow!("All {} Valhalla isochrone computations failed", locations.len()));
        }

        if success_count < locations.len() {
            warn!("⚠️  Only {} out of {} Valhalla isochrones succeeded - algorithm will continue", success_count, locations.len());
        }

        Ok(isochrones)
    }

    async fn compute_isochrone(&self, request: &IsochroneRequest) -> Result<IsochroneResult> {
        let time_limit = request.time_limit.unwrap_or(30);
        let profile = request.profile.as_deref().unwrap_or("pedestrian");
        
        info!("🔗 Calling Valhalla isochrone API for {:.6}, {:.6} with {}min", 
              request.point.latitude, request.point.longitude, time_limit);

        // Build Valhalla isochrone request
        let valhalla_request = self.build_isochrone_request(request)?;
        
        // Call Valhalla API
        let response = self.client
            .post(&format!("{}/isochrone", self.valhalla_url))
            .json(&valhalla_request)
            .send()
            .await
            .map_err(|e| anyhow!("Failed to call Valhalla isochrone API: {}", e))?;

        let status = response.status();
        let response_text = response.text().await
            .map_err(|e| anyhow!("Failed to read Valhalla response: {}", e))?;

        if !status.is_success() {
            error!("❌ Valhalla API error {}: {}", status, response_text);
            return Err(anyhow!("Valhalla API returned error {}: {}", status, response_text));
        }

        debug!("📨 Valhalla response: {}", response_text);

        // Parse Valhalla response and create result
        let polygon = self.parse_isochrone_response(&response_text)?;

        Ok(IsochroneResult {
            location: request.point.clone(),
            time_limit_minutes: time_limit,
            profile: profile.to_string(),
            polygon,
        })
    }

    fn build_isochrone_request(&self, request: &IsochroneRequest) -> Result<Value> {
        const DEPARTURE_TIME: &str = "2025-05-01T12:00";
        let time_limit = request.time_limit.unwrap_or(30);
        let profile = request.profile.as_deref().unwrap_or("pedestrian");
        
        // Map profile to Valhalla costing
        let costing = match profile {
            "pt" | "transit" => "multimodal",
            "car" | "driving" => "auto", 
            "bike" | "cycling" => "bicycle",
            "foot" | "walking" | "pedestrian" => "pedestrian",
            _ => "pedestrian",
        };

        let valhalla_request = json!({
            "locations": [{
                "lat": request.point.latitude,
                "lon": request.point.longitude
            }],
            "costing": costing,
            "contours": [{
                "time": time_limit,
                "color": "ff0000"
            }],
            "polygons": true,
            "denoise": 0.1,
            "generalize": 5,
            "date_time": {
                "type": 1, // Depart at
                "value": DEPARTURE_TIME
            }
        });

        Ok(valhalla_request)
    }

    fn parse_isochrone_response(&self, response_text: &str) -> Result<Polygon<f64>> {
        let geojson: Value = serde_json::from_str(response_text)
            .map_err(|e| anyhow!("Failed to parse Valhalla GeoJSON: {}", e))?;

        let features = geojson["features"].as_array()
            .ok_or_else(|| anyhow!("No features found in Valhalla response"))?;

        if features.is_empty() {
            return Err(anyhow!("No isochrone features found"));
        }

        // Get the largest contour (assuming it's the one we want)
        let feature = &features[0];
        let geometry = &feature["geometry"];
        
        match geometry["type"].as_str() {
            Some("Polygon") => {
                let coordinates = geometry["coordinates"].as_array()
                    .ok_or_else(|| anyhow!("Invalid polygon coordinates"))?;
                
                if coordinates.is_empty() {
                    return Err(anyhow!("Empty polygon coordinates"));
                }
                
                let exterior_coords = coordinates[0].as_array()
                    .ok_or_else(|| anyhow!("Invalid exterior coordinates"))?;
                
                let coords: Result<Vec<Coord<f64>>, _> = exterior_coords
                    .iter()
                    .map(|point| {
                        let array = point.as_array()
                            .ok_or_else(|| anyhow!("Invalid coordinate point"))?;
                        
                        if array.len() < 2 {
                            return Err(anyhow!("Coordinate point needs at least 2 values"));
                        }
                        
                        let lon = array[0].as_f64()
                            .ok_or_else(|| anyhow!("Invalid longitude"))?;
                        let lat = array[1].as_f64()
                            .ok_or_else(|| anyhow!("Invalid latitude"))?;
                        
                        Ok(Coord { x: lon, y: lat })
                    })
                    .collect();
                
                let coords = coords?;
                let line_string = LineString::new(coords);
                let polygon = Polygon::new(line_string, vec![]);
                
                Ok(polygon)
            }
            Some("LineString") => {
                // Handle LineString by converting to polygon
                let coordinates = geometry["coordinates"].as_array()
                    .ok_or_else(|| anyhow!("Invalid LineString coordinates"))?;
                
                let coords: Result<Vec<Coord<f64>>, _> = coordinates
                    .iter()
                    .map(|point| {
                        let array = point.as_array()
                            .ok_or_else(|| anyhow!("Invalid coordinate point"))?;
                        
                        if array.len() < 2 {
                            return Err(anyhow!("Coordinate point needs at least 2 values"));
                        }
                        
                        let lon = array[0].as_f64()
                            .ok_or_else(|| anyhow!("Invalid longitude"))?;
                        let lat = array[1].as_f64()
                            .ok_or_else(|| anyhow!("Invalid latitude"))?;
                        
                        Ok(Coord { x: lon, y: lat })
                    })
                    .collect();
                
                let mut coords = coords?;
                
                // Close the polygon if not already closed
                if let (Some(first), Some(last)) = (coords.first(), coords.last()) {
                    if first != last {
                        coords.push(*first);
                    }
                }
                
                let line_string = LineString::new(coords);
                let polygon = Polygon::new(line_string, vec![]);
                
                Ok(polygon)
            }
            _ => Err(anyhow!("Unsupported geometry type in Valhalla response"))
        }
    }

    pub fn get_isochrone_intersections(&self, isochrones: &[IsochroneResult]) -> Vec<Polygon<f64>> {
        
        if isochrones.is_empty() {
            return Vec::new();
        }
        
        if isochrones.len() == 1 {
            return vec![isochrones[0].polygon.clone()];
        }
        
        // Sort isochrones by location coordinates for deterministic processing
        let mut sorted_isochrones = isochrones.to_vec();
        sorted_isochrones.sort_by(|a, b| {
            a.location.latitude.partial_cmp(&b.location.latitude)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| a.location.longitude.partial_cmp(&b.location.longitude)
                    .unwrap_or(std::cmp::Ordering::Equal))
        });
        
        let mut intersections = Vec::new();
        
        // Find all pairwise intersections with deterministic ordering
        for i in 0..sorted_isochrones.len() {
            for j in i + 1..sorted_isochrones.len() {
                let intersection_result = sorted_isochrones[i].polygon.intersection(&sorted_isochrones[j].polygon);
                
                for polygon in intersection_result {
                    let intersection_area_deg2 = polygon.unsigned_area();
                    let min_area = 0.00001; // Increased threshold for better stability: ~0.1m² in degrees
                    
                    if intersection_area_deg2 >= min_area {
                        intersections.push(polygon);
                    }
                }
            }
        }
        
        // If we have more than 2 isochrones, find the intersection of all (deterministic order)
        if sorted_isochrones.len() > 2 {
            let mut current_intersection = sorted_isochrones[0].polygon.clone();
            
            for isochrone in sorted_isochrones.iter().skip(1) {
                let intersection_result = current_intersection.intersection(&isochrone.polygon);
                
                if intersection_result.is_empty() {
                    break; // No global intersection exists
                }
                
                // Select largest polygon deterministically by area
                if let Some(largest_polygon) = intersection_result.into_iter()
                    .max_by(|a, b| a.unsigned_area().partial_cmp(&b.unsigned_area())
                        .unwrap_or(std::cmp::Ordering::Equal)) {
                    current_intersection = largest_polygon;
                } else {
                    break; // No valid intersection polygons found
                }
            }
            
            let intersection_area_deg2 = current_intersection.unsigned_area();
            let min_area = 0.00001; // Consistent threshold
            
            if intersection_area_deg2 >= min_area {
                // Improved duplicate detection using relative area comparison
                let is_duplicate = intersections.iter().any(|existing| {
                    let area_diff = (existing.unsigned_area() - current_intersection.unsigned_area()).abs();
                    let relative_diff = area_diff / current_intersection.unsigned_area().max(existing.unsigned_area());
                    relative_diff < 0.001 // 0.1% relative difference threshold
                });
                
                if !is_duplicate {
                    intersections.push(current_intersection);
                }
            }
        }
        
        // Sort final intersections by area for consistent ordering
        intersections.sort_by(|a, b| b.unsigned_area().partial_cmp(&a.unsigned_area())
            .unwrap_or(std::cmp::Ordering::Equal));
        
        intersections
    }
} 