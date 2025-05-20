// backend/core-api/src/routes/meeting_point.rs - Modified version

use actix_web::{web, HttpResponse, Responder};
use chrono::Utc;
use log::{error, info};
use serde::{Deserialize, Serialize};
use reqwest::Client;
use std::env;

use crate::algorithms::meeting_point::MeetingPointFinder;
use crate::models::location::{AddressInput, MeetingPointResponse, Venue};

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/api/meeting-point")
            .route(web::post().to(find_meeting_point)),
    );
}

#[derive(Debug, Deserialize)]
struct MeetingPointRequest {
    addresses: Vec<AddressInput>,
    departure_time: Option<i64>,     
    venue_types: Option<Vec<String>>,
    venue_radius: Option<f64>,
    exclude_venues: Option<bool>,
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
        Ok((meeting_point, routes)) => {

            let venues = if !request.exclude_venues.unwrap_or(false) {

                let venue_types = request.venue_types.clone()
                    .unwrap_or_else(|| vec!["restaurant".to_string()]);
                

                let radius = request.venue_radius.unwrap_or(500.0);
                
                match fetch_venues_from_google(
                    meeting_point.coordinates,
                    venue_types,
                    radius
                ).await {
                    Ok(venues) => Some(venues),
                    Err(e) => {
                        error!("Error fetching venues: {}", e);
                        None
                    }
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

async fn fetch_venues_from_google(
    location: (f64, f64), 
    types: Vec<String>,
    radius: f64
) -> anyhow::Result<Vec<Venue>> {
    let api_key = env::var("MAPS_PLACES_API_KEY")
        .map_err(|_| anyhow::anyhow!("Google Places API key not configured"))?;
    
    // Create a custom client with proper SSL configuration
    let client = Client::builder()
        .use_rustls_tls() // Use rustls instead of native-tls
        .build()
        .map_err(|e| anyhow::anyhow!("Failed to create HTTP client: {}", e))?;
    
    let (lng, lat) = location; // Convert to lat,lng for Google API
    
    let type_param = types.join("|");
    
    let url = format!(
        "https://maps.googleapis.com/maps/api/place/nearbysearch/json?location={},{}&radius={}&type={}&key={}",
        lat, lng, radius, type_param, api_key
    );
    
    let response = client.get(&url)
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("Google Places API request failed: {}", e))?;
    
    let places_response: GooglePlacesResponse = response.json()
        .await
        .map_err(|e| anyhow::anyhow!("Failed to parse Google Places API response: {}", e))?;
    
    if places_response.status != "OK" && places_response.status != "ZERO_RESULTS" {
        return Err(anyhow::anyhow!("Google Places API error: {}", 
                                  places_response.error_message.unwrap_or_else(|| places_response.status)));
    }
    
    let venues = places_response.results.into_iter()
        .map(|place| Venue {
            id: place.place_id,
            name: place.name,
            location: (place.geometry.location.lng, place.geometry.location.lat),
            address: place.vicinity,
            types: place.types,
            rating: place.rating,
            photo_reference: place.photos.and_then(|photos| 
                                                 photos.first().map(|p| p.photo_reference.clone())),
            price_level: place.price_level,
        })
        .collect();
    
    Ok(venues)
}

#[derive(Debug, Deserialize)]
struct GooglePlacesResponse {
    results: Vec<PlaceResult>,
    status: String,
    error_message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PlaceResult {
    place_id: String,
    name: String,
    vicinity: String,
    geometry: Geometry,
    types: Vec<String>,
    rating: Option<f64>,
    photos: Option<Vec<Photo>>,
    price_level: Option<i32>,
}

#[derive(Debug, Deserialize)]
struct Geometry {
    location: Location,
}

#[derive(Debug, Deserialize)]
struct Location {
    lat: f64,
    lng: f64,
}

#[derive(Debug, Deserialize)]
struct Photo {
    photo_reference: String,
    height: i32,
    width: i32,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}