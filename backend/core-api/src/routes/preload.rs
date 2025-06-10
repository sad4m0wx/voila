use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use log::{info, warn};

use crate::models::Location;
use crate::models::isochrone::IsochroneRequest;
use crate::services::isochrone_service::IsochroneService;
use crate::services::cache_service::CacheService;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/api/preload/isochrone")
            .route(web::post().to(preload_isochrone_handler)),
    );
}

#[derive(Debug, Deserialize)]
struct PreloadRequest {
    location: Location,
    time_limit: Option<u32>,  // defaults to 30 minutes
    profile: Option<String>,  // defaults to "pt"
}

#[derive(Debug, Serialize)]
struct PreloadResponse {
    success: bool,
    cached: Vec<u32>,  // time limits that were already cached
    computed: Vec<u32>,  // time limits that were computed now
    message: String,
    error: Option<String>,
}

async fn preload_isochrone_handler(request: web::Json<PreloadRequest>) -> impl Responder {
    let base_time_limit = request.time_limit.unwrap_or(30);
    let profile = request.profile.as_deref().unwrap_or("pt");
    
    // Precompute multiple time limits that the meeting point algorithm might use
    // Algorithm tries: [original, original+5, original+10], so we cover common ranges
    let time_limits = if base_time_limit == 30 {
        vec![25, 30, 35, 40] // Common case: cover 25-40 minutes, also 20 is quick enough
    } else {
        vec![base_time_limit] // Custom case: use specified time limit
    };
    
    info!("🎯 Preload request: {:?} ({}min variants: {:?}, {})", 
          request.location, base_time_limit, time_limits, profile);

    let cache_service = CacheService::cache().await;
    let isochrone_service = IsochroneService::new();
    
    let mut cached = Vec::new();
    let mut computed = Vec::new();
    let mut any_error = None;

    for time_limit in time_limits {
        // Check if already cached
        if let Some(_cached) = cache_service.get_cached_isochrone(&request.location, time_limit, profile).await {
            info!("✅ Already cached: {}min", time_limit);
            cached.push(time_limit);
            continue;
        }

        // Check if another request is already computing this isochrone
        if cache_service.is_isochrone_computing(&request.location, time_limit, profile).await {
            info!("⏳ Already computing: {}min", time_limit);
            continue;
        }

        // Compute this time limit
        let isochrone_request = IsochroneRequest {
            point: request.location.clone(),
            time_limit: Some(time_limit),
            distance_limit: None,
            profile: Some(profile.to_string()),
            buckets: Some(1),
            reverse_flow: Some(false),
        };
        
        match isochrone_service.get_isochrone(&isochrone_request).await {
            Ok(_result) => {
                info!("🚀 Precomputed and cached: {}min", time_limit);
                computed.push(time_limit);
            }
            Err(e) => {
                warn!("❌ Preload failed for {}min: {}", time_limit, e);
                any_error = Some(e.to_string());
            }
        }
    }
    
    let total_processed = cached.len() + computed.len();
    let cached_count = cached.len();
    let computed_count = computed.len();
    let success = total_processed > 0;
    
    HttpResponse::Ok().json(PreloadResponse {
        success,
        cached,
        computed,
        message: if success {
            format!("Processed {} isochrones ({} cached, {} computed)", 
                   total_processed, cached_count, computed_count)
        } else {
            "Failed to process any isochrones".to_string()
        },
        error: any_error,
    })
} 