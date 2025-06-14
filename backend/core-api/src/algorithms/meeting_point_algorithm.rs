use geo::{Point, MultiPoint, Polygon, Centroid, Area};
use anyhow::Result;

<<<<<<< Updated upstream
use crate::models::{Location, MeetingPoint, DebugData, DebugCandidate, DebugIsochrone, DebugPolygon, Route, LineString, TravelTime};
=======
use crate::models::{Location, MeetingPoint, DebugData, DebugCandidate, DebugIsochrone, DebugPolygon, Route, TravelTime};
use crate::models::geometry::LineString;
use crate::models::debug::DebugIsochroneData;
>>>>>>> Stashed changes
use crate::models::isochrone::IsochroneResult;
use crate::services::isochrone_service::IsochroneService;
use crate::services::route_service::RouteService;
use log::{info, warn};

pub struct MeetingPointAlgorithm {
    isochrone_service: IsochroneService,
    route_service: RouteService,
}

impl MeetingPointAlgorithm {
<<<<<<< Updated upstream
    /// Find optimal meeting point using isochrone intersection approach
    pub async fn find_meeting_point(
        locations: &[(String, Location)],
    ) -> Result<(MeetingPoint, Vec<Route>, Option<DebugData>)> {
        
=======
    pub fn new() -> Self {
        Self {
            isochrone_service: IsochroneService::new(),
            route_service: RouteService::new(),
        }
    }

    /// Find optimal meeting point using isochrones
    pub async fn find_meeting_point(
        &self,
        locations: &[(String, Location)],
    ) -> Result<(MeetingPoint, Vec<Route>, Option<DebugData>)> {

>>>>>>> Stashed changes
        // Step 1: Calculate geometric center
        let center = Self::calculate_centroid(locations);
        info!("📍 Geometric center: ({:.6}, {:.6})", center.latitude, center.longitude);
        
        // Step 2: Estimate time limit by computing travel time to centroid
        let time_limit_minutes = self.estimate_time_to_center(locations, &center).await?;
        info!("⏱️  Estimated time limit: {}min", time_limit_minutes);
        
        // Step 3: Get isochrones with retry logic for better intersections
<<<<<<< Updated upstream
        let isochrone_service = IsochroneService::new();
        let mut intersections = Vec::new();
        let mut candidates = Vec::new();
        let mut final_time_limit = time_limit_minutes;
        let mut final_isochrones = Vec::new();
=======
        let mut intersections = Vec::new();
        let mut final_isochrone_results = Vec::new();
>>>>>>> Stashed changes
        
        let time_limits_to_try = [time_limit_minutes, time_limit_minutes + 5, time_limit_minutes + 10];
        
<<<<<<< Updated upstream
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
=======
        for time_limit in time_limits_to_try {
            info!("🔄 Trying time limit: {}min", time_limit);
            
            let isochrone_results = self.isochrone_service.get_isochrones(locations, time_limit, Some("pt".to_string())).await?;

            if isochrone_results.is_empty() {
                warn!("⚠️  No isochrone results for time limit {}min", time_limit);
                continue;
>>>>>>> Stashed changes
            }

            // Compute intersections using improved method
            let current_intersections = self.isochrone_service.get_isochrone_intersections(&isochrone_results);
            
            if !current_intersections.is_empty() {
                info!("✅ Found {} intersections for time limit {}min", current_intersections.len(), time_limit);
                intersections = current_intersections;
                final_isochrone_results = isochrone_results;
                break;
            }
        }
        
        if intersections.is_empty() {
            return Err(anyhow::anyhow!("No valid intersections found"));
        }
        
        // Step 4: Generate candidate points from intersections
        let candidates: Vec<Location> = self.generate_candidates(&intersections);
        info!("🎯 Generated {} candidate points", candidates.len());
        
        // Step 5: Evaluate candidates and find optimal meeting point
        let (optimal_point, routes) = self.evaluate_candidates(&candidates, locations).await?;
        
        let meeting_point = MeetingPoint {
            name: "Optimal Meeting Point".to_string(),
            coordinates: (optimal_point.longitude, optimal_point.latitude),
            travel_times: routes.iter().zip(locations.iter()).map(|(route, (id, location))| {
                TravelTime {
                    id: id.clone(),
                    address: location.address.clone().unwrap_or_else(|| 
                        format!("{:.4}, {:.4}", location.latitude, location.longitude)
                    ),
                    duration: route.steps.iter().map(|step| step.duration).sum::<u32>() / 60, // Convert to minutes
                    distance: route.steps.iter().map(|step| step.distance).sum(),
                    estimated: false,
                    transit_summary: None,
                }
            }).collect(),
        };
        
        // Step 6: Prepare debug data with full isochrones for frontend visualization
        let debug_data = Some(DebugData {
            geometric_centroid: (center.longitude, center.latitude),
<<<<<<< Updated upstream
            isochrones: Self::convert_isochrones_debug(&final_isochrones, locations),
            intersection_polygons: Self::convert_intersections_debug(&intersections),
            candidate_points: Self::convert_candidates_debug(&candidates),
            final_candidates: vec![],
=======
            isochrones: Self::convert_isochrone_results_debug(&final_isochrone_results, locations),
            intersection_polygons: Self::convert_intersections_debug(&intersections),
            candidate_points: Self::convert_candidates_debug(&candidates),
            final_candidates: vec![DebugCandidate {
                id: "optimal".to_string(),
                coordinates: (optimal_point.longitude, optimal_point.latitude),
                source: "optimal".to_string(),
                score: None,
            }],
            isochrone_data: Some(Self::convert_isochrone_data_debug(&final_isochrone_results)),
>>>>>>> Stashed changes
        });
        
        Ok((meeting_point, routes, debug_data))
    }

    fn calculate_centroid(locations: &[(String, Location)]) -> Location {
        let points: Vec<Point<f64>> = locations.iter()
            .map(|(_, loc)| Point::new(loc.longitude, loc.latitude))
            .collect();
        
        let multipoint = MultiPoint::from(points);
        let centroid = multipoint.centroid().unwrap();
        
        Location::new(centroid.y(), centroid.x())
    }

    async fn estimate_time_to_center(&self, locations: &[(String, Location)], center: &Location) -> Result<u32> {        
        let routes = self.route_service.get_transit_routes(locations, center).await;

        let max_time_seconds : u32 = routes.iter()
            .filter_map(|route| route.as_ref().ok())
            .map(|route| route.1 as u32)
            .max()
            .unwrap_or(0);
        
        let avg_time_minutes = max_time_seconds / 60;
        let margin_time = avg_time_minutes as f64 * 1.2;
        let rounded_time_limit = ((margin_time as u32 + 4) / 5) * 5; // Rounds up to nearest 5
        let capped_time_limit = rounded_time_limit.min(90);
        
        info!("⏱️  Estimated travel time: {}min, using time limit: {}min", avg_time_minutes, capped_time_limit);
        Ok(capped_time_limit)
    }


    fn generate_candidates(&self, intersections: &[Polygon<f64>]) -> Vec<Location> {
        //TODO: add more candidates
        let mut candidates: Vec<Location> = Vec::new();
        
        for polygon in intersections {
            if let Some(centroid) = polygon.centroid() {
                candidates.push(Location::new(centroid.y(), centroid.x()));
            }
        }
        
        candidates
    }


    //TODO!!!
    async fn evaluate_candidates(&self, candidates: &[Location], locations: &[(String, Location)]) -> Result<(Location, Vec<Route>)> {
        let mut best_candidate = None;
        let mut best_max_time = u32::MAX;
        let mut best_routes = Vec::new();

        for candidate in candidates {   
            let route_results = self.route_service.get_transit_routes(locations, &candidate).await;

            let max_time = route_results.iter()
                .filter_map(|route| route.as_ref().ok())
                .map(|route| route.1 as u32)
                .max()
                .unwrap_or(0);
            
            if max_time < best_max_time {
                best_max_time = max_time;
                best_candidate = Some(candidate.clone());
                // Convert successful route results to Route structs
                best_routes = route_results.iter().zip(locations.iter())
                    .filter_map(|(route_result, (id, _))| {
                        route_result.as_ref().ok().map(|(_duration, _distance, steps)| {
                            Route {
                                id: id.clone(),
                                geometry: LineString::new(vec![]), // TODO: Add actual geometry
                                steps: steps.clone(),
                            }
                        })
                    })
                    .collect();
            }
        }

        match best_candidate {
            Some(candidate) => Ok((candidate, best_routes)),
            None => Err(anyhow::anyhow!("No valid candidate found"))
        }

    }

    fn convert_isochrone_results_debug(isochrone_results: &[IsochroneResult], _locations: &[(String, Location)]) -> Vec<DebugIsochrone> {
        isochrone_results.iter().enumerate().map(|(i, isochrone_result)| {
            DebugIsochrone {
                origin_id: format!("location_{}", i + 1),
                time_limit_minutes: isochrone_result.time_limit_minutes as f64,
                area_km2: isochrone_result.polygon.unsigned_area() * 111.0 * 111.0,
                polygon: Self::polygon_to_debug(&format!("location_{}", i + 1), &isochrone_result.polygon),
            }
        }).collect()
    }

<<<<<<< Updated upstream
    /// Convert intersection polygons for debug display
=======
    fn convert_isochrone_data_debug(isochrone_results: &[IsochroneResult]) -> Vec<DebugIsochroneData> {
        isochrone_results.iter().enumerate().map(|(i, isochrone_result)| {
            DebugIsochroneData {
                origin_id: format!("location_{}", i + 1),
                location: (isochrone_result.location.longitude, isochrone_result.location.latitude),
                time_limit_minutes: isochrone_result.time_limit_minutes as f64,
                profile: isochrone_result.profile.clone(),
                polygon_area_km2: isochrone_result.polygon.unsigned_area() * 111.0 * 111.0,
                polygon_vertices: isochrone_result.polygon.exterior().coords().count(),
                algorithm_used: "traditional_isochrone".to_string(),
                computation_time_ms: 0, // This would need to be tracked if needed
            }
        }).collect()
    }

>>>>>>> Stashed changes
    fn convert_intersections_debug(intersections: &[Polygon<f64>]) -> Vec<DebugPolygon> {
        intersections.iter().enumerate().map(|(i, polygon)| {
            Self::polygon_to_debug(&format!("intersection_{}", i), polygon)
        }).collect()
    }

    fn convert_candidates_debug(candidates: &[Location]) -> Vec<DebugCandidate> {
        candidates.iter().enumerate().map(|(i, candidate)| {
            DebugCandidate {
                id: format!("candidate_{}", i),
                coordinates: (candidate.longitude, candidate.latitude),
                source: "intersection".to_string(),
                score: None,
            }
        }).collect()
    }

    fn polygon_to_debug(_id: &str, polygon: &Polygon<f64>) -> DebugPolygon {
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
}