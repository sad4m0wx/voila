use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use log::{error, info};

use crate::algorithms::transit_graph::TransitRouter;
use crate::models::location::Location;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/api/itinerary")
            .route(web::post().to(get_transit_directions)),
    );
}

#[derive(Debug, Deserialize)]
struct DirectionsRequest {
    origin: (f64, f64),      // [longitude, latitude]
    destination: (f64, f64), // [longitude, latitude]
    departure_time: Option<u32>,
}

#[derive(Debug, Serialize)]
struct DirectionsResponse {
    duration: u32,  // seconds
    distance: f64,  // meters
}

async fn get_transit_directions(request: web::Json<DirectionsRequest>) -> impl Responder {
    info!("Received transit directions request");
    
    let origin = Location::new(request.origin.1, request.origin.0);
    let destination = Location::new(request.destination.1, request.destination.0);
    
    // Call the transit routing algorithm
    match TransitRouter::find_route(&origin, &destination, request.departure_time) {
        Ok((duration, distance)) => {
            let response = DirectionsResponse {
                duration: duration.as_secs() as u32,
                distance,
            };
            
            HttpResponse::Ok().json(response)
        }
        Err(err) => {
            error!("Error calculating transit directions: {}", err);
            HttpResponse::InternalServerError().json(ErrorResponse {
                error: format!("Failed to calculate transit directions: {}", err),
            })
        }
    }
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}