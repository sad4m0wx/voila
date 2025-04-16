use actix_web::{web, HttpResponse, Responder};
use log::{error, info};
use serde::{Deserialize, Serialize};

use crate::algorithms::meeting_point::MeetingPointFinder;
use crate::models::location::{
    AddressInput, LineString, MeetingPointRequest, MeetingPointResponse, Route,
};

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/api/meeting-point")
            .route(web::post().to(find_meeting_point)),
    );
}

async fn find_meeting_point(request: web::Json<MeetingPointRequest>) -> impl Responder {
    info!("Received meeting point request with {} addresses", request.addresses.len());
    
    if request.addresses.len() < 2 {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: "At least two addresses are required".to_string(),
        });
    }
    
    // Make sure all addresses have coordinates
    let valid_addresses: Vec<_> = request
        .addresses
        .iter()
        .filter(|addr| addr.coordinates.is_some())
        .cloned()
        .collect();
    
    if valid_addresses.len() < 2 {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: "At least two addresses with valid coordinates are required".to_string(),
        });
    }
    
    // Call the meeting point algorithm
    match MeetingPointFinder::find_optimal_meeting_point(&valid_addresses) {
        Ok(meeting_point) => {
            // Create simple straight-line routes TODO: use the itinerary algorithm
            let routes: Vec<Route> = valid_addresses
                .iter()
                .map(|addr| {
                    let start = addr.coordinates.unwrap();
                    let end = meeting_point.coordinates;
                    
                    Route {
                        id: addr.id.clone(),
                        geometry: LineString::new(vec![start, end]),
                    }
                })
                .collect();
            
            let response = MeetingPointResponse {
                meeting_point,
                routes,
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

#[derive(Serialize, Deserialize)]
struct ErrorResponse {
    error: String,
}