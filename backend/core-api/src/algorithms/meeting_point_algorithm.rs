use geo::{Point, MultiPoint, Polygon, Area, BoundingRect, Contains, Centroid};
use anyhow::Result;

use crate::models::{Location, MeetingPoint, DebugData, DebugCandidate, DebugIsochrone, DebugPolygon, Route, LineString, TravelTime};
use crate::models::isochrone::IsochroneResult;
use crate::services::isochrone_service::IsochroneService;
use crate::services::route_service::RouteService;
use log::warn;

pub struct MeetingPointAlgorithm;

#[derive(Debug, Clone)]
struct CandidateEvaluationResult {
    location: Location,
    max_travel_time: f64,
    avg_travel_time: f64, 
}

impl MeetingPointAlgorithm {
    /// Find optimal meeting point using isochrone intersection approach
    pub async fn find_meeting_point(
        locations: &[(String, Location)],
    ) -> Result<(MeetingPoint, Vec<Route>, Option<DebugData>)> {
        
        // Step 1: Calculate geometric center
        let center = Self::calculate_centroid(locations);
        log::info!("📍 Geometric center: ({:.6}, {:.6})", center.latitude, center.longitude);
        
        // Step 2: Estimate time limit by computing travel time to centroid
        let time_limit_minutes = Self::estimate_time_to_center(locations, &center).await?;
        log::info!("⏱️  Estimated time limit: {}min", time_limit_minutes);
        
        // Step 3: Get isochrones with retry logic for better intersections
        let isochrone_service = IsochroneService::new();
        let mut intersections = Vec::new();
        let mut candidates = Vec::new();
        let mut final_time_limit = time_limit_minutes;
        let mut final_isochrones = Vec::new();
        
        // Try with original time limit, then +5min, then +10min
        let time_limits_to_try = [time_limit_minutes, time_limit_minutes + 5, time_limit_minutes + 10];
        
        for (attempt, time_limit) in time_limits_to_try.iter().enumerate() {
            log::info!("🔄 Attempt {} with {}min time limit", attempt + 1, time_limit);
            
            let isochrones = isochrone_service.get_isochrones(
                locations, 
                *time_limit, 
                Some("pt".to_string())
            ).await?;

            if isochrones.is_empty() {
                log::warn!("❌ Failed to generate isochrones with {}min time limit", time_limit);
                continue;
            }

            log::info!("🌐 Generated {} isochrones with {}min", isochrones.len(), time_limit);

            // Try to find intersections
            intersections = isochrone_service.get_isochrone_intersections(&isochrones);
            log::info!("🎯 Found {} intersection polygons with {}min", intersections.len(), time_limit);

            if !intersections.is_empty() {
                // Generate candidates from successful intersections
                candidates = Self::generate_candidates_from_intersections(&intersections);
                log::info!("🔍 Generated {} candidate points with {}min", candidates.len(), time_limit);
                
                if !candidates.is_empty() {
                    log::info!("✅ Found viable solution with {}min time limit on attempt {}", time_limit, attempt + 1);
                    final_time_limit = *time_limit;
                    final_isochrones = isochrones;
                    break;
                }
            }
            
            log::warn!("⚠️  No viable candidates with {}min time limit, trying next...", time_limit);
        }

        if candidates.is_empty() {
            return Err(anyhow::anyhow!("No viable candidates found even with extended time limits (tried {}min, {}min, {}min)", 
                time_limits_to_try[0], time_limits_to_try[1], time_limits_to_try[2]));
        }
        
        log::info!("🎯 Using {}min time limit for final solution", final_time_limit);
        
        // Step 6: Evaluate candidates (TODO: implement proper evaluation)
        let best_candidate = Self::evaluate_candidates(locations, &candidates).await?;
        log::info!("🏆 Selected best candidate at ({:.6}, {:.6})", 
                  best_candidate.latitude, best_candidate.longitude);
        
        // Step 7: Generate final routes
        let routes = Self::generate_final_routes(locations, &best_candidate).await?;
        
        let meeting_point = MeetingPoint {
            name: "Intersection-based Meeting Point".to_string(),
            coordinates: (best_candidate.longitude, best_candidate.latitude),
            travel_times: Self::create_travel_times(locations, &routes),
        };
        
        // Create debug data
        let debug_data = Some(DebugData {
            geometric_centroid: (center.longitude, center.latitude),
            isochrones: Self::convert_isochrones_debug(&final_isochrones, locations),
            intersection_polygons: Self::convert_intersections_debug(&intersections),
            candidate_points: Self::convert_candidates_debug(&candidates),
            final_candidates: vec![],
        });
        
        Ok((meeting_point, routes, debug_data))
    }

    fn calculate_centroid(locations: &[(String, Location)]) -> Location {
        let points: Vec<Point<f64>> = locations
            .iter()
            .map(|(_, location)| location.to_point())
            .collect();

        let multi_point = MultiPoint::new(points);
        multi_point.centroid()
            .map(|c| Location::new(c.y(), c.x()))
            .unwrap_or_else(|| locations[0].1.clone())
    }

    async fn estimate_time_to_center(
        locations: &[(String, Location)],
        center: &Location,
    ) -> Result<u32> {
        let route_service = RouteService::new();
        let durations = route_service.get_transit_routes(locations, center).await;
        
        if durations.is_empty() {
            return Ok(30);
        }

        let durations_minutes: Vec<f64> = durations.iter().map(|&d| d / 60.0).collect();
        
        // Use the average travel time with a 10% margin as time limit
        let avg_time = durations_minutes.iter().sum::<f64>() / durations_minutes.len() as f64;
        let margin_time = avg_time * 1.2;
        let rounded_time_limit = ((margin_time as u32 + 4) / 5) * 5; // Rounds up to nearest 5
        let capped_time_limit = rounded_time_limit.min(90);
        
        log::info!("📊 Average travel time: {:.1}min, time limit: {}min", avg_time, capped_time_limit);
        
        Ok(capped_time_limit)
    }

    fn generate_candidates_from_intersections(intersections: &[Polygon<f64>]) -> Vec<Location> {
        let mut candidates = Vec::new();
        const MAX_CANDIDATES_PER_POLYGON: usize = 12;
        const MAX_CANDIDATES: usize = 50;
        const GRID_RESOLUTION: usize = 4;
        
        for intersection in intersections.iter() {
            let mut polygon_candidates = Vec::new();
            
            // Strategy 1: Centroid (most important)
            if let Some(centroid) = intersection.centroid() {
                polygon_candidates.push(Location::new(centroid.y(), centroid.x()));
            }
            
            // Strategy 2: Coarse grid sampling within bounding box
            if let Some(bbox) = intersection.bounding_rect() {
                let lat_step = (bbox.max().y - bbox.min().y) / GRID_RESOLUTION as f64;
                let lng_step = (bbox.max().x - bbox.min().x) / GRID_RESOLUTION as f64;
                
                for i in 1..GRID_RESOLUTION {
                    for j in 1..GRID_RESOLUTION {
                        let lat = bbox.min().y + i as f64 * lat_step;
                        let lng = bbox.min().x + j as f64 * lng_step;
                        let point = Point::new(lng, lat);
                        
                        if intersection.contains(&point) {
                            polygon_candidates.push(Location::new(lat, lng));
                        }
                    }
                }
            }
            
            // Sample polygon vertices
            let exterior_points: Vec<_> = intersection.exterior().points().collect();
            for point in exterior_points.iter().step_by(exterior_points.len().max(1) / 3) {
                polygon_candidates.push(Location::new(point.y(), point.x()));
            }
            
            polygon_candidates.truncate(MAX_CANDIDATES_PER_POLYGON);
            candidates.extend(polygon_candidates);
        }
        
        candidates.truncate(MAX_CANDIDATES);
        candidates
    }
    /// Evaluate candidates using minimax algorithm with tie-breaking
    async fn evaluate_candidates(
        locations: &[(String, Location)],
        candidates: &[Location],
    ) -> Result<Location> {
        if candidates.is_empty() {
            return Err(anyhow::anyhow!("No candidates to evaluate"));
        }
        
        let route_service = RouteService::new();
        let mut best_candidate: Option<CandidateEvaluationResult> = None;
        
        for candidate in candidates.iter() {
            let travel_times = route_service.get_transit_routes(locations, candidate).await;
            
            if travel_times.is_empty() {
                continue;
            }
            
            let times_minutes: Vec<f64> = travel_times.iter().map(|&t| t / 60.0).collect();
            let max_time = times_minutes.iter().fold(0.0, |a: f64, &b| a.max(b));
            let avg_time = times_minutes.iter().sum::<f64>() / times_minutes.len() as f64;
            
            
            let evaluation = CandidateEvaluationResult {
                location: candidate.clone(),
                max_travel_time: max_time,
                avg_travel_time: avg_time,
            };
            
            // Update best candidate if this one is better
            let is_better = match &best_candidate {
                None => true,
                Some(current_best) => {
                    // Primary: lower max time wins
                    if evaluation.max_travel_time < current_best.max_travel_time - 0.5 {
                        true
                    } else if (evaluation.max_travel_time - current_best.max_travel_time).abs() < 0.5 {
                        // Tie-breaker: lower average time wins
                        evaluation.avg_travel_time < current_best.avg_travel_time
                    } else {
                        false
                    }
                }
            };
            
            if is_better {
                best_candidate = Some(evaluation);
            }
        }
        
        match best_candidate {
            Some(result) => Ok(result.location),
            None => Err(anyhow::anyhow!("Failed to evaluate any candidates"))
        }
    }

    /// Generate final routes to the meeting point
    async fn generate_final_routes(
        locations: &[(String, Location)],
        meeting_point: &Location,
    ) -> Result<Vec<Route>> {
        let route_service = RouteService::new();
        let mut routes = Vec::new();
        
        for (id, origin) in locations {
            let route = match route_service.get_transit_route(origin, meeting_point).await {
                Ok((_duration, _distance, steps)) => {
                    let geometry = RouteService::extract_geometry_from_steps(
                        &steps, origin, meeting_point
                    );
                    
                    Route {
                        id: id.clone(),
                        geometry: LineString::new(geometry),
                        steps,
                    }
                }
                Err(e) => {
                    warn!("Failed to generate route for {}: {}", id, e);
                    Route {
                        id: id.clone(),
                        geometry: LineString::new(vec![
                            (origin.longitude, origin.latitude),
                            (meeting_point.longitude, meeting_point.latitude),
                        ]),
                        steps: vec![],
                    }
                }
            };
            
            routes.push(route);
        }
        
        Ok(routes)
    }

    fn create_travel_times(
        locations: &[(String, Location)],
        routes: &[Route],
    ) -> Vec<TravelTime> {
        locations.iter().zip(routes.iter()).map(|((id, location), route)| {
            let duration_minutes = if !route.steps.is_empty() {
                route.steps.iter().map(|step| step.duration).sum::<u32>() / 60
            } else {
                let total_distance: f64 = route.geometry.coordinates.windows(2)
                    .map(|pair| {
                        let loc1 = Location::new(pair[0].1, pair[0].0);
                        let loc2 = Location::new(pair[1].1, pair[1].0);
                        loc1.distance_to(&loc2)
                    })
                    .sum();
                (total_distance / 7.0 / 60.0) as u32
            };

            let transit_summary = Self::generate_transit_summary(&route.steps);

            TravelTime {
                id: id.clone(),
                address: location.address.clone().unwrap_or_else(|| 
                    format!("{:.4}, {:.4}", location.latitude, location.longitude)
                ),
                duration: duration_minutes,
                distance: 0.0,
                estimated: route.steps.is_empty(),
                transit_summary: Some(transit_summary),
            }
        }).collect()
    }

    fn generate_transit_summary(steps: &[crate::models::transit::TransitStep]) -> String {
        if steps.is_empty() {
            return "Route details unavailable".to_string();
        }

        let mut summary_parts = Vec::new();
        let mut total_walking_time = 0u32;
        
        for step in steps {
            match step.mode.as_str() {
                "transit" => {
                    if let Some(details) = &step.transit_details {
                        let line_info = if let Some(short_name) = &details.line.short_name {
                            format!("{} {}", details.line.vehicle_type, short_name)
                        } else {
                            details.line.name.clone()
                        };
                        
                        let duration_min = step.duration / 60;
                        let stops_info = if details.num_stops > 0 {
                            format!(" ({} stops)", details.num_stops)
                        } else {
                            String::new()
                        };
                        
                        summary_parts.push(format!(
                            "Take {} for {}min{}", 
                            line_info, 
                            duration_min.max(1),
                            stops_info
                        ));
                    }
                }
                "walk" => {
                    total_walking_time += step.duration;
                }
                _ => {}
            }
        }
        
        if total_walking_time > 60 {
            let walking_min = total_walking_time / 60;
            summary_parts.push(format!("Walk {}min", walking_min));
        }
        
        if summary_parts.is_empty() {
            "Transit route".to_string()
        } else {
            summary_parts.join(", ")
        }
    }

    /// Convert isochrones for debug display
    fn convert_isochrones_debug(isochrones: &[IsochroneResult], locations: &[(String, Location)]) -> Vec<DebugIsochrone> {
        isochrones.iter().enumerate().map(|(i, iso)| {
            let origin_id = locations.get(i)
                .map(|(id, _)| id.clone())
                .unwrap_or_else(|| format!("origin_{}", i));
            
            DebugIsochrone {
                origin_id,
                time_limit_minutes: iso.time_limit_minutes as f64,
                area_km2: Self::polygon_area_km2(&iso.polygon),
                polygon: Self::polygon_to_debug("isochrone", &iso.polygon),
            }
        }).collect()
    }

    /// Convert intersection polygons for debug display
    fn convert_intersections_debug(intersections: &[Polygon<f64>]) -> Vec<DebugPolygon> {
        intersections.iter().enumerate().map(|(i, polygon)| {
            Self::polygon_to_debug(&format!("intersection_{}", i), polygon)
        }).collect()
    }

    /// Convert candidate points for debug display
    fn convert_candidates_debug(candidates: &[Location]) -> Vec<DebugCandidate> {
        candidates.iter().enumerate().map(|(i, location)| {
            DebugCandidate {
                id: format!("candidate_{}", i),
                coordinates: (location.longitude, location.latitude),
                source: "intersection_centroid".to_string(),
                score: None, // TODO: Add score when evaluation is implemented
            }
        }).collect()
    }

    /// Convert polygon to debug format
    fn polygon_to_debug(_name: &str, polygon: &Polygon<f64>) -> DebugPolygon {
        let mut coordinates = Vec::new();
        
        // Exterior ring
        let exterior: Vec<(f64, f64)> = polygon.exterior().points()
            .map(|point| (point.x(), point.y()))
            .collect();
        coordinates.push(exterior);
        
        // Interior rings (holes)
        for interior in polygon.interiors() {
            let hole: Vec<(f64, f64)> = interior.points()
                .map(|point| (point.x(), point.y()))
                .collect();
            coordinates.push(hole);
        }
        
        DebugPolygon {
            r#type: "Polygon".to_string(),
            coordinates,
        }
    }

    /// Calculate polygon area in km²
    fn polygon_area_km2(polygon: &Polygon<f64>) -> f64 {
        let area_deg2 = polygon.unsigned_area();
        area_deg2 * 111.0 * 111.0 // Convert degrees² to km²
    }
}