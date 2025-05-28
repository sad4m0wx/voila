use actix_web::{web, HttpResponse, Responder};
use log::{error, info};
use serde::{Deserialize, Serialize};

use crate::algorithms::find_optimal_meeting_point;
use crate::models::location::{AddressInput, MeetingPointResponse};

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/api/meeting-point")
            .route(web::post().to(find_meeting_point_handler)),
    );
}

#[derive(Debug, Deserialize)]
struct MeetingPointRequest {
    addresses: Vec<AddressInput>,
    max_travel_time_minutes: Option<u32>,
    profile: Option<String>,
    include_venues: Option<bool>,
    venue_options: Option<VenueOptions>,
}

#[derive(Debug, Deserialize)]
struct VenueOptions {
    types: Vec<String>,
    radius: u32,
}

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
    
    // Use the race manager to find optimal meeting point
    let race_result = find_optimal_meeting_point(
        &request.addresses,
        request.max_travel_time_minutes,
        request.profile.clone(),
    ).await;
    
    match race_result {
        Ok(result) => {
            info!("Meeting point found using {} algorithm in {}ms", 
                  result.algorithm_used, result.processing_time_ms);
            
            // TODO: Add venue fetching if requested
            let venues = if request.include_venues.unwrap_or(false) {
                // Venue fetching is disabled for now - can be re-enabled later
                None
            } else {
                None
            };
            
            let response = MeetingPointResponse {
                meeting_point: result.meeting_point,
                routes: result.routes,
                venues,
            };
            
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