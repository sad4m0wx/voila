use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use log::info;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/api/venues")
            .route(web::post().to(find_nearby_venues)),
    );
}

#[derive(Debug, Deserialize)]
struct NearbyVenuesRequest {
    location: (f64, f64),  // [longitude, latitude]
    radius: Option<f64>,   // meters
    types: Option<Vec<String>>, // e.g., ["restaurant", "cafe", "bar"]
}

#[derive(Debug, Serialize)]
struct Venue {
    id: String,
    name: String,
    location: (f64, f64),
    address: String,
    types: Vec<String>,
    rating: Option<f64>,
}

#[derive(Debug, Serialize)]
struct NearbyVenuesResponse {
    venues: Vec<Venue>,
}

async fn find_nearby_venues(request: web::Json<NearbyVenuesRequest>) -> impl Responder {
    //info!("Received nearby venues request for location: {:?}", request.location);
    
    // This is a placeholder - in a real implementation we would query a database or external API
    let response = NearbyVenuesResponse {
        venues: Vec::new(),
    };

    HttpResponse::Ok().json(response)
}