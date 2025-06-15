use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use log::{info, warn};

use crate::models::Location;
use crate::models::isochrone::IsochroneRequest;
use crate::services::isochrone_service::IsochroneService;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/api/preload/isochrone")
            .route(web::post().to(preload_isochrone_handler)),
    );
}

#[derive(Debug, Deserialize)]
struct PreloadRequest {
    location: Location,
    time_limits: Option<Vec<u32>>,  // defaults to [20, 25, 30, 35, 40]
    profile: Option<String>        // defaults to "pt"
}

#[derive(Debug, Serialize)]
struct PreloadResponse {
    success: bool,
    message: String,
    error: Option<String>,
}

async fn preload_isochrone_handler(request: web::Json<PreloadRequest>) -> impl Responder {
    let profile = request.profile.as_deref().unwrap_or("pt");
    let time_limits = request.time_limits.as_ref()
        .map(|v| v.clone())
        .unwrap_or_else(|| vec![20, 25, 30, 35, 40]);
    
    info!("📥 Preload request for location: {:?} ({:?}min, {})", request.location, time_limits, profile);
    
    let service = IsochroneService::new();
    let mut processed_count = 0;
    let mut any_error = None;

    for time_limit in time_limits {
        let isochrone_request = IsochroneRequest {
            point: request.location.clone(),
            time_limit: Some(time_limit),
            distance_limit: None,
            profile: Some(profile.to_string()),
            buckets: Some(1),
            reverse_flow: Some(false),
        };
        
        // The isochrone service handles caching internally
        match service.get_isochrone(&isochrone_request).await {
            Ok(_) => {
                info!("✅ Processed {}min isochrone", time_limit);
                processed_count += 1;
            }
            Err(e) => {
                warn!("❌ Failed to process {}min isochrone: {}", time_limit, e);
                any_error = Some(e.to_string());
            }
        }
    }
    
    let success = processed_count > 0;
    
    HttpResponse::Ok().json(PreloadResponse {
        success,
        message: if success {
            format!("Successfully processed {} isochrones", processed_count)
        } else {
            "Failed to process any isochrones".to_string()
        },
        error: any_error,
    })
}