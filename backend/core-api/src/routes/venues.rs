use actix_web::{web, HttpResponse, Responder, Error};
use serde::{Deserialize, Serialize};
use log::info;

//pub fn configure(cfg: &mut web::ServiceConfig) {
//    cfg.service(
//        web::resource("/api/venues")
//            .route(web::post().to(find_nearby_venues)),
//    );
//}

#[derive(Debug, Deserialize)]
pub struct NearbyVenuesRequest {
    pub location: (f64, f64),  // [longitude, latitude]
    pub radius: Option<f64>,   // meters
    pub types: Option<Vec<String>>, // e.g., ["restaurant", "cafe", "bar"]
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Venue {
    id: String,
    name: String,
    location: (f64, f64),
    address: String,
    types: Vec<String>,
    rating: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct NearbyVenuesResponse {
    pub venues: Vec<Venue>,
}

pub async fn find_nearby_venues(request: NearbyVenuesRequest) -> Result<NearbyVenuesResponse, Error> {
    //info!("Received nearby venues request for location: {:?}", request.location);
    
    // This is a placeholder - in a real implementation we would query a database or external API
    let response = NearbyVenuesResponse {
        venues: Vec::new(),
    };

    Ok(response)
}