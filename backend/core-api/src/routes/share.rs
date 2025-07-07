use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use log::{info, warn, error};
use uuid::Uuid;
use anyhow::Result;

use crate::models::api::{MeetingPointResponse, AddressInput};
use crate::models::location::Location;
use crate::services::cache_service::CacheService;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/api/share")
            .route(web::post().to(create_share_handler))
    )
    .service(
        web::resource("/api/shared/{share_id}")
            .route(web::get().to(get_shared_handler))
    );
}

#[derive(Debug, Deserialize)]
struct CreateShareRequest {
    addresses: Vec<AddressInput>,  // Same format as meeting point request
}

#[derive(Debug, Serialize)]
struct CreateShareResponse {
    share_id: String,
    share_url: String,
    mobile_url: String,
    expires_at: Option<i64>,
}

#[derive(Debug, Serialize)]
struct GetSharedResponse {
    meeting_point_result: MeetingPointResponse,
    metadata: ShareMetadata,
}

#[derive(Debug, Serialize)]
struct ShareMetadata {
    share_id: String,
    created_at: i64,
    expires_at: Option<i64>,
}

#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: String,
    message: String,
}

async fn create_share_handler(
    request: web::Json<CreateShareRequest>,
) -> impl Responder {
    info!("📤 Creating share link for {} addresses", request.addresses.len());

    // Convert addresses to locations (same logic as meeting_point.rs)
    let locations: Vec<(String, Location)> = request.addresses.iter()
        .filter_map(|addr| {
            if let Some((lon, lat)) = addr.coordinates {
                let location = Location::new(lat, lon)
                    .with_address(addr.address.as_deref().unwrap_or("Unknown"));
                Some((addr.id.clone(), location))
            } else {
                None
            }
        })
        .collect();
    
    if locations.len() < 2 {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: "INVALID_REQUEST".to_string(),
            message: "At least two valid locations are required".to_string(),
        });
    }

    let cache_service = CacheService::global().await;
    
    // Verify that the meeting point result exists in cache using existing function
    if cache_service.get_cached_meeting_point_result(&locations).await.is_none() {
        warn!("❌ Attempted to share non-existent meeting point with {} locations", locations.len());
        return HttpResponse::NotFound().json(ErrorResponse {
            error: "NOT_FOUND".to_string(),
            message: "Meeting point result not found or has expired".to_string(),
        });
    }

    // Generate a unique share ID
    let share_id = Uuid::new_v4().to_string();
    
    // Store locations as JSON in share mapping
    match serde_json::to_string(&locations) {
        Ok(locations_json) => {
            match cache_service.create_share_mapping(&share_id, &locations_json, None).await {
                Ok(_) => {
                    let base_url = std::env::var("PUBLIC_BASE_URL")
                        .unwrap_or_else(|_| "https://voila-app.fr".to_string());
                    
                    let share_url = format!("{}/shared/{}", base_url, share_id);
                    let mobile_url = format!("voila://shared/{}", share_id);
                    
                    info!("✅ Created share link: {}", share_url);
                    
                    HttpResponse::Ok().json(CreateShareResponse {
                        share_id: share_id.clone(),
                        share_url,
                        mobile_url,
                        expires_at: None, // Using default TTL
                    })
                }
                Err(e) => {
                    error!("❌ Failed to create share mapping: {}", e);
                    HttpResponse::InternalServerError().json(ErrorResponse {
                        error: "INTERNAL_ERROR".to_string(),
                        message: "Failed to create share link".to_string(),
                    })
                }
            }
        }
        Err(e) => {
            error!("❌ Failed to serialize locations: {}", e);
            HttpResponse::InternalServerError().json(ErrorResponse {
                error: "INTERNAL_ERROR".to_string(),
                message: "Failed to process locations".to_string(),
            })
        }
    }
}

async fn get_shared_handler(
    path: web::Path<String>,
) -> impl Responder {
    let share_id = path.into_inner();
    info!("📥 Retrieving shared meeting point: {}", share_id);

    let cache_service = CacheService::global().await;
    
    // Get the locations JSON from the share mapping
    match cache_service.get_share_mapping(&share_id).await {
        Some(locations_json) => {
            match serde_json::from_str::<Vec<(String, Location)>>(&locations_json) {
                Ok(locations) => {
                    // Use existing cache function to get meeting point result
                    match cache_service.get_cached_meeting_point_result(&locations).await {
                        Some(meeting_point_result) => {
                            info!("✅ Successfully retrieved shared meeting point: {}", share_id);
                            
                            HttpResponse::Ok().json(GetSharedResponse {
                                meeting_point_result,
                                metadata: ShareMetadata {
                                    share_id: share_id.clone(),
                                    created_at: chrono::Utc::now().timestamp(),
                                    expires_at: None,
                                },
                            })
                        }
                        None => {
                            warn!("❌ Meeting point result not found for share: {}", share_id);
                            HttpResponse::NotFound().json(ErrorResponse {
                                error: "EXPIRED".to_string(),
                                message: "The shared meeting point has expired or no longer exists".to_string(),
                            })
                        }
                    }
                }
                Err(e) => {
                    error!("❌ Failed to deserialize locations for share {}: {}", share_id, e);
                    HttpResponse::InternalServerError().json(ErrorResponse {
                        error: "INTERNAL_ERROR".to_string(),
                        message: "Failed to process shared meeting point".to_string(),
                    })
                }
            }
        }
        None => {
            warn!("❌ Share mapping not found: {}", share_id);
            HttpResponse::NotFound().json(ErrorResponse {
                error: "NOT_FOUND".to_string(),
                message: "Shared meeting point not found".to_string(),
            })
        }
    }
} 