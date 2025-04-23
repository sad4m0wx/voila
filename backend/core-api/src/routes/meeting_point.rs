use actix_web::{web, HttpResponse, Responder};
use chrono::Utc;
use log::{error, info};
use serde::{Deserialize, Serialize};

use crate::algorithms::meeting_point::MeetingPointFinder;
use crate::models::location::{AddressInput, MeetingPointResponse};
use crate::routes::venues;
use crate::services::graphhopper_client::GraphHopperClient;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/api/meeting-point")
            .route(web::post().to(find_meeting_point)),
    );
}

#[derive(Debug, Deserialize)]
struct MeetingPointRequest {
    addresses: Vec<AddressInput>,
    departure_time: Option<i64>,      // Unix timestamp
    include_venues: Option<bool>,     // Whether to include venue recommendations
    transport_mode: Option<String>,   // For future use: "transit", "car", etc.
}

async fn find_meeting_point(request: web::Json<MeetingPointRequest>) -> impl Responder {
    info!("Received meeting point request with {} addresses", request.addresses.len());
    
    if request.addresses.len() < 2 {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: "At least two addresses are required".to_string(),
        });
    }
    
    // Find optimal meeting point with transit times
    match MeetingPointFinder::find_optimal_meeting_point(&request.addresses, request.departure_time).await {
        Ok(meeting_point) => {
            // Get detailed transit routes for each participant
            let graphhopper = GraphHopperClient::new();
            let mut routes = Vec::new();
            
            let departure = request.departure_time.map(|ts| 
                chrono::DateTime::<Utc>::from_timestamp(ts, 0).unwrap()
            );
            
            // Calculate detailed routes
            for address in &request.addresses {
                if let Some(coords) = address.coordinates {
                    let from = crate::models::location::Location::new(coords.1, coords.0);
                    let to = crate::models::location::Location::new(
                        meeting_point.coordinates.1, 
                        meeting_point.coordinates.0
                    );
                    
                    match graphhopper.get_transit_route(&from, &to, departure).await {
                        Ok((_, _, steps)) => {
                            info!("Route found for address: {}", address.id);
                            routes.push(crate::models::location::Route {
                                id: address.id.clone(),
                                steps,
                                geometry: crate::models::location::LineString::new(vec![
                                    coords,
                                    meeting_point.coordinates,
                                ]),
                            });
                        }
                        Err(_) => {
                            error!("Failed to find route for address: {}", address.id);
                            // Fallback to simple line if routing fails
                            routes.push(crate::models::location::Route {
                                id: address.id.clone(),
                                steps: Vec::new(),
                                geometry: crate::models::location::LineString::new(vec![
                                    coords,
                                    meeting_point.coordinates,
                                ]),
                            });
                        }
                    }
                }
            }
            
            // Optionally get venue recommendations
            let venues = if request.include_venues.unwrap_or(false) {
                // Call the venues endpoint (simplified)
                let venue_request = venues::NearbyVenuesRequest {
                    location: meeting_point.coordinates,
                    radius: Some(500.0),
                    types: Some(vec!["restaurant".to_string(), "cafe".to_string()]),
                };
                
                match venues::find_nearby_venues(venue_request).await {
                    Ok(venue_resp) => Some(venue_resp.venues),
                    Err(_) => None,
                }
            } else {
                None
            };
            
            // Return the unified response
            let response = MeetingPointResponse {
                meeting_point,
                routes,
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

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}