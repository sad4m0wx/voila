use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use log::{info, warn};
use geo::Area;

use crate::models::Location;
use crate::models::debug::{DebugIsochrone, DebugPolygon, DebugIsochroneData};
use crate::models::isochrone::{IsochroneRequest, IsochroneResult};
use crate::services::isochrone_service::IsochroneService;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/api/preload/isochrone")
            .route(web::post().to(preload_isochrone_handler)),
    );
}

#[derive(Debug, Deserialize)]
struct PreloadRequest {
    location: Location,
    time_limit: Option<u32>,  // defaults to 30 minutes
    profile: Option<String>,  // defaults to "pt"
}

#[derive(Debug, Serialize)]
struct PreloadResponse {
    success: bool,
    cached: Vec<u32>,  // time limits that were already cached
    computed: Vec<u32>,  // time limits that were computed now
    message: String,
    error: Option<String>,
    isochrones: Vec<DebugIsochrone>,
    isochrone_data: Vec<DebugIsochroneData>,
}

async fn preload_isochrone_handler(request: web::Json<PreloadRequest>) -> impl Responder {
    let time_limit = request.time_limit.unwrap_or(30);
    let profile = request.profile.as_deref().unwrap_or("pt");
    
    info!("📥 Preload request for location: {:?} ({}min, {})", 
          request.location, time_limit, profile);
    
    // Define time limits to compute
    let time_limits = vec![20, 25, 30, 35, 40];
    
    let service = IsochroneService::new();
    let cached = Vec::new();
    let mut computed = Vec::new();
    let mut any_error = None;
    let mut all_results: Vec<IsochroneResult> = Vec::new();

    for time_limit in time_limits {
        let isochrone_request = IsochroneRequest {
            point: request.location.clone(),
            time_limit: Some(time_limit),
            distance_limit: None,
            profile: Some(profile.to_string()),
            buckets: Some(1),
            reverse_flow: Some(false),
        };
        
        // Try to get the result (either from cache or compute)
        match service.get_isochrone(&isochrone_request).await {
            Ok(result) => {
                info!("✅ Got result for {}min", time_limit);
                computed.push(time_limit);
                all_results.push(result);
            }
            Err(e) => {
                warn!("❌ Failed to get result for {}min: {}", time_limit, e);
                any_error = Some(e.to_string());
            }
        }
    }
    
    // Convert results to debug format for frontend visualization
    let isochrones: Vec<DebugIsochrone> = all_results.iter().map(|result| {
        DebugIsochrone {
            origin_id: format!("preload_{}min", result.time_limit_minutes),
            time_limit_minutes: result.time_limit_minutes as f64,
            area_km2: result.polygon.unsigned_area() * 111.0 * 111.0,
            polygon: polygon_to_debug(&result.polygon),
        }
    }).collect();

    let isochrone_data: Vec<DebugIsochroneData> = all_results.iter().map(|result| {
        DebugIsochroneData {
            origin_id: format!("preload_{}min", result.time_limit_minutes),
            location: (result.location.longitude, result.location.latitude),
            time_limit_minutes: result.time_limit_minutes as f64,
            profile: result.profile.clone(),
            polygon_area_km2: result.polygon.unsigned_area() * 111.0 * 111.0,
            polygon_vertices: result.polygon.exterior().coords().count(),
            algorithm_used: "traditional_isochrone".to_string(),
            computation_time_ms: 0, // This would need to be tracked if needed
        }
    }).collect();
    
    let total_processed = cached.len() + computed.len();
    let cached_count = cached.len();
    let computed_count = computed.len();
    let success = total_processed > 0;
    
    HttpResponse::Ok().json(PreloadResponse {
        success,
        cached,
        computed,
        message: if success {
            format!("Processed {} isochrones ({} cached, {} computed)", 
                   total_processed, cached_count, computed_count)
        } else {
            "Failed to process any isochrones".to_string()
        },
        error: any_error,
        isochrones,
        isochrone_data,
    })
}



fn polygon_to_debug(polygon: &geo::Polygon<f64>) -> DebugPolygon {
    let mut coordinates = Vec::new();
    
    // Add exterior ring
    let exterior: Vec<(f64, f64)> = polygon.exterior().coords()
        .map(|coord| (coord.x, coord.y))
        .collect();
    coordinates.push(exterior);
    
    // Add interior rings (holes)
    for interior in polygon.interiors() {
        let hole: Vec<(f64, f64)> = interior.coords()
            .map(|coord| (coord.x, coord.y))
            .collect();
        coordinates.push(hole);
    }
    
    DebugPolygon {
        r#type: "Polygon".to_string(),
        coordinates,
    }
}