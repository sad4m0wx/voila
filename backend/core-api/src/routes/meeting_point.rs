use actix_web::{web, HttpResponse, Responder};
use log::{error, info};
use serde::Serialize;

use crate::algorithms::MeetingPointAlgorithm;
use crate::models::MeetingPointResponse;
use crate::models::api::MeetingPointRequest;
use crate::services::cache_service::CacheService;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/api/meeting-point")
            .route(web::post().to(find_meeting_point_handler)),
    );
}

pub static CACHE_TTL: u32 = 30; // 30 days
pub static CACHE_TTL_SECONDS: u32 = CACHE_TTL * 24 * 3600; // 30 days



#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: String,
}

async fn find_meeting_point_handler(request: web::Json<MeetingPointRequest>) -> impl Responder {
    info!("Received meeting point request with {} addresses", request.addresses.len());
    
    // Validate request
    if request.addresses.len() < 2 {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: "At least two addresses are required".to_string(),
        });
    }

    // Validate that addresses have coordinates
    let valid_addresses: Vec<_> = request.addresses.iter()
        .filter(|addr| addr.coordinates.is_some())
        .collect();
    if valid_addresses.len() < 2 {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: "At least two addresses with valid coordinates are required".to_string(),
        });
    }
    
    let start_time = std::time::Instant::now();
    
    // Step 1: Round coordinates and resolve to locations in one step
    let resolved_locations: Vec<(String, crate::models::location::Location)> = request.addresses.iter()
        .filter_map(|addr| {
            if let Some((lon, lat)) = addr.coordinates {
                // Round to 4 decimal places (~10m precision)
                let rounded_lat = (lat * 10000.0).round() / 10000.0;
                let rounded_lon = (lon * 10000.0).round() / 10000.0;
                let location = crate::models::location::Location::new(rounded_lat, rounded_lon)
                    .with_address(addr.address.as_deref().unwrap_or("Unknown"));
                Some((addr.id.clone(), location))
            } else {
                None
            }
        })
        .collect();

    // Validate we have enough valid locations
    if resolved_locations.len() < 2 {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: "At least two addresses with valid coordinates are required".to_string(),
        });
    }
    
    // Step 2: Check for complete cache hit
    let cache_service = CacheService::cache().await;
    if let Some(cached_result) = cache_service.get_cached_meeting_point_result(&resolved_locations).await {
        let processing_time_ms = start_time.elapsed().as_millis();
        info!("🎯 Complete cache hit! Returned in {}ms", processing_time_ms);
        return HttpResponse::Ok().json(cached_result);
    }
    
    // Step 3: Cache miss - compute with algorithm
    info!("💾 Cache miss - computing with algorithm");
    let result = MeetingPointAlgorithm::find_meeting_point(&resolved_locations).await;
    let processing_time_ms = start_time.elapsed().as_millis();
    
    match result {
        Ok((meeting_point, routes, debug_data)) => {
            info!("Meeting point found using algorithm in {}ms", processing_time_ms);

            let response = MeetingPointResponse {
                meeting_point,
                routes,
                venues: None,
                debug_data,
            };
            
            // Step 4: Cache the complete result for 30 days
            let _ = cache_service.cache_meeting_point_result(
                &resolved_locations, 
                &response, 
                Some(CACHE_TTL_SECONDS) // 30 days TTL
            ).await;
            
            HttpResponse::Ok().json(response)
        }
        Err(err) => {
            error!("Error finding meeting point: {}", err);
            HttpResponse::InternalServerError().json(ErrorResponse {
                error: format!("Failed to calculate meeting point: {}", err),
            })
        }
    }
}

