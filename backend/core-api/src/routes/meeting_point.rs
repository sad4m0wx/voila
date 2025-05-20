// backend/core-api/src/routes/meeting_point.rs - Modified version

use actix_web::{web, HttpResponse, Responder};
use chrono::Utc;
use log::{error, info};
use serde::{Deserialize, Serialize};
use reqwest::Client;
use std::env;
use serde_json;

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
    
    let client = Client::new();
    let (lng, lat) = location;
    
    let request_body = serde_json::json!({
        "includedTypes": types,
        "maxResultCount": 15,
        "locationRestriction": {
            "circle": {
                "center": {
                    "latitude": lat,
                    "longitude": lng
                },
                "radius": radius
            }
        }
    });

    let field_mask = "places.displayName,places.id,places.photos,places.googleMapsLinks,places.location";
    
    let response = client.post("https://places.googleapis.com/v1/places:searchNearby")
        .header("Content-Type", "application/json")
        .header("X-Goog-Api-Key", api_key)
        .header("X-Goog-FieldMask", field_mask)
        .json(&request_body)
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
    
    let venues = places_response.places.into_iter()
        .map(|place| Venue {
            id: place.id,
            name: place.display_name.text,
            location: (place.location.latitude, place.location.longitude),
            photo_reference: place.photos.and_then(|photos| 
                photos.first().map(|p| p.name.clone())),
            google_maps_links: place.google_maps_links.map(|links| vec![
                links.directions_uri,
                links.place_uri,
                links.write_a_review_uri,
                links.reviews_uri,
                links.photos_uri
            ]),
        })
        .collect();
    
    Ok(venues)
}

#[derive(Debug, Deserialize)]
struct GooglePlacesResponse {
    places: Vec<PlaceResult>,
    status: String,
    error_message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PlaceResult {
    id: String,
    display_name: DisplayName,
    photos: Option<Vec<Photo>>,
    google_maps_links: Option<GoogleMapsLinks>,
    location: Location,
}

#[derive(Debug, Deserialize)]
struct DisplayName {
    text: String,
    language_code: String,
}

#[derive(Debug, Deserialize)]
struct Location {
    latitude: f64,
    longitude: f64,
}

#[derive(Debug, Deserialize)]
struct Photo {
    name: String,
    width_px: i32,
    height_px: i32,
    author_attributions: Vec<AuthorAttribution>,
    flag_content_uri: String,
    google_maps_uri: String,
}

#[derive(Debug, Deserialize)]
struct AuthorAttribution {
    display_name: String,
    uri: String,
    photo_uri: String,
}

#[derive(Debug, Deserialize)]
struct GoogleMapsLinks {
    directions_uri: String,
    place_uri: String,
    write_a_review_uri: String,
    reviews_uri: String,
    photos_uri: String,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}