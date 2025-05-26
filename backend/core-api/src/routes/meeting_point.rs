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
    match MeetingPointFinder::find_optimal_meeting_point(&request.addresses).await {
        Ok((meeting_point, routes)) => {

            let venues = None; /*if !request.exclude_venues.unwrap_or(false) {

                let venue_types = request.venue_types.clone()
                    .unwrap_or_else(|| vec!["restaurant".to_string()]);
                

                let radius = request.venue_radius.unwrap_or(500.0);
                
                match fetch_venues_from_google(
                    meeting_point.coordinates,
                    venue_types,
                    radius
                ).await {
                    Ok(venues) => Some(vec![]),
                    Err(e) => {
                        error!("Error fetching venues: {}", e);
                        None
                    }
                }
                None
            } else {
                None
            };*/
            
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
    
    // Use the passed types parameter instead of hardcoded values
    let venue_types = if types.is_empty() {
        vec!["restaurant".to_string(), "cafe".to_string(), "bar".to_string()]
    } else {
        types
    };
    
    let field_mask = "places.displayName,places.id,places.photos,places.googleMapsLinks,places.location";

    info!("Fetching venues for types: {:?} at location: ({}, {})", venue_types, lat, lng);

    // Query each venue type separately and merge results
    let all_venues = futures::future::join_all(venue_types.iter().map(|venue_type| {
        let request_body = serde_json::json!({
            "includedTypes": [venue_type],
            "maxResultCount": 10,
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

        let client = client.clone();
        let api_key = api_key.clone();
        let field_mask = field_mask.to_string();
        let venue_type = venue_type.clone();
        
        async move {
            let response = client.post("https://places.googleapis.com/v1/places:searchNearby")
                .header("Content-Type", "application/json")
                .header("X-Goog-Api-Key", api_key)
                .header("X-Goog-FieldMask", field_mask)
                .json(&request_body)
                .send()
                .await
                .map_err(|e| anyhow::anyhow!("Google Places API request failed for {}: {}", venue_type, e))?;

            if !response.status().is_success() {
                let error_text = response.text().await.unwrap_or_default();
                return Err(anyhow::anyhow!("Google Places API returned error for {}: {}", venue_type, error_text));
            }

            let places_response: GooglePlacesResponse = response.json()
                .await
                .map_err(|e| anyhow::anyhow!("Failed to parse Google Places API response for {}: {}", venue_type, e))?;

            // Return both the places and the venue type
            Ok::<Vec<(PlaceResult, String)>, anyhow::Error>(
                places_response.places.into_iter()
                    .map(|place| (place, venue_type.clone()))
                    .collect()
            )
        }
    }))
    .await
    .into_iter()
    .filter_map(|result| {
        match result {
            Ok(venues) => Some(venues),
            Err(e) => {
                error!("Error fetching venues: {}", e);
                None
            }
        }
    })
    .flatten()
    .collect::<Vec<_>>();
    
    let venues: Vec<Venue> = all_venues.into_iter()
        .map(|(place, venue_type)| Venue {
            id: place.id,
            name: place.displayName.text,
            location: (place.location.latitude, place.location.longitude),
            photo_reference: place.photos.and_then(|photos| 
                photos.first().map(|p| p.name.clone())),
            google_maps_links: place.googleMapsLinks.map(|links| vec![
                links.directionsUri,
                links.placeUri,
                links.writeAReviewUri,
                links.reviewsUri,
                links.photosUri
            ]),
            types: venue_type,
        })
        .collect();

    info!("Fetched {} venues", venues.len());
    Ok(venues)
}

#[derive(Debug, Deserialize)]
struct GooglePlacesResponse {
    places: Vec<PlaceResult>,
}

#[derive(Debug, Deserialize)]
struct PlaceResult {
    id: String,
    location: Location,
    displayName: DisplayName,
    photos: Option<Vec<Photo>>,
    googleMapsLinks: Option<GoogleMapsLinks>,
    #[serde(default)]
    types: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DisplayName {
    text: String,
}

#[derive(Debug, Deserialize)]
struct Location {
    latitude: f64,
    longitude: f64,
}

#[derive(Debug, Deserialize)]
struct Photo {
    name: String,
    widthPx: i32,
    heightPx: i32,
    authorAttributions: Vec<AuthorAttribution>,
    flagContentUri: String,
    googleMapsUri: String,
}

#[derive(Debug, Deserialize)]
struct AuthorAttribution {
    displayName: String,
    uri: String,
    photoUri: String,
}

#[derive(Debug, Deserialize)]
struct GoogleMapsLinks {
    directionsUri: String,
    placeUri: String,
    writeAReviewUri: String,
    reviewsUri: String,
    photosUri: String,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
}