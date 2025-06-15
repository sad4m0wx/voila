use actix_web::{web, HttpResponse, Responder};
use log::{info, warn};

use crate::algorithms::meeting_point_algorithm::MeetingPointAlgorithm;
use crate::models::api::{MeetingPointRequest, MeetingPointResponse};
use crate::services::cache_service::CacheService;


pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/api/meeting-point")
            .route(web::post().to(meeting_point_handler)),
    );
}

async fn meeting_point_handler(
    request: web::Json<MeetingPointRequest>,
) -> impl Responder {
    let start_time = std::time::Instant::now();
    info!("📍 Processing meeting point request with {} addresses", request.addresses.len());

    // Convert addresses to locations
    let locations: Vec<(String, _)> = request.addresses.iter()
        .filter_map(|addr| {
            if let Some((lon, lat)) = addr.coordinates {
                let location = crate::models::location::Location::new(lat, lon)
                    .with_address(addr.address.as_deref().unwrap_or("Unknown"));
                Some((addr.id.clone(), location))
            } else {
                None
            }
        })
        .collect();
    
    if locations.len() < 2 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "At least two valid locations are required"
        }));
    }

    // Step 2: Check for complete cache hit
    let cache_service = CacheService::global().await;
    if let Some(cached_result) = cache_service.get_cached_meeting_point_result(&locations).await {
        let processing_time_ms = start_time.elapsed().as_millis();
        info!("🎯 Complete cache hit! Returned in {}ms", processing_time_ms);
        return HttpResponse::Ok().json(cached_result);
    }
    
    let algorithm = MeetingPointAlgorithm::new();
    
    match algorithm.find_meeting_point(&locations).await {
        Ok((meeting_point, routes, debug_data)) => {
            let processing_time_ms = start_time.elapsed().as_millis();
            info!("💾 Caching meeting point result for {} addresses in {}ms", locations.len(), processing_time_ms);
            
            let response = MeetingPointResponse {
                meeting_point,
                routes,
                venues: None,
                debug_data,
            };

            
            if let Err(e) = cache_service.cache_meeting_point_result(&locations, &response, None).await {
                warn!("❌ Failed to cache meeting point result: {}", e);
            }
            HttpResponse::Ok().json(response)
        }
        Err(e) => {
            HttpResponse::BadRequest().json(serde_json::json!({
                "error": e.to_string()
            }))
        }
    }
}

