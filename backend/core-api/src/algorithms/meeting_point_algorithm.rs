use geo::{Point, MultiPoint, Polygon, Centroid, Area};
use anyhow::Result;

use crate::models::{Location, MeetingPoint, DebugData, DebugCandidate, DebugIsochrone, DebugPolygon, Route, TravelTime};
use crate::models::geometry::LineString;
use crate::models::debug::DebugIsochroneData;

use crate::models::isochrone::IsochroneResult;
use crate::services::isochrone_service::IsochroneService;
use crate::services::route_service::RouteService;
use log::{info, error};

#[derive(Debug, PartialEq)]
enum AreaFitness {
    TooSmall,
    JustRight,
    TooLarge,
}

pub struct MeetingPointAlgorithm {
    isochrone_service: IsochroneService,
    route_service: RouteService,
}

impl MeetingPointAlgorithm {

    pub fn new() -> Self {
        Self {
            isochrone_service: IsochroneService::new(),
            route_service: RouteService::new(),
        }
    }

    pub async fn find_meeting_point(
        &self,
        locations: &[(String, Location)],
    ) -> Result<(MeetingPoint, Vec<Route>, Option<DebugData>)> {

        let start_time = std::time::Instant::now();

        // Step 1: Calculate geometric center
        let center = Self::calculate_centroid(locations);
        info!("📍 Geometric center: ({:.6}, {:.6})", center.latitude, center.longitude);
        
        // Step 2: Estimate time limit by computing travel time to centroid
        let time_limit_minutes = self.estimate_time_to_center(locations, &center).await?;
        info!("⏱️  Estimated time limit: {}min", time_limit_minutes);
        
        // Step 3: Get optimal isochrones with adaptive area control
        let (final_isochrones, intersections, candidates) = self
            .find_optimal_isochrone_candidates(locations, time_limit_minutes)
            .await?;
        
        if intersections.is_empty() || candidates.is_empty() {
            return Err(anyhow::anyhow!("No valid intersections or candidates found"));
        }
        info!("🎯 Generated {} candidate points", candidates.len());
        
        // Step 5: Evaluate candidates and find optimal meeting point
        let (optimal_point, routes, durations) = self.evaluate_candidates(&candidates, locations).await?;
        
        let meeting_point = MeetingPoint {
            name: "Optimal Meeting Point".to_string(),
            coordinates: (optimal_point.longitude, optimal_point.latitude),
            travel_times: routes.iter().zip(locations.iter()).zip(durations.iter()).map(|((route, (id, location)), &duration)| {
                TravelTime {
                    id: id.clone(),
                    address: location.address.clone().unwrap_or_else(|| 
                        format!("{:.4}, {:.4}", location.latitude, location.longitude)
                    ),
                    duration: duration / 60, // Convert seconds to minutes
                    distance: route.steps.iter().map(|step| step.distance).sum(),
                    estimated: false,
                    transit_summary: None,
                }
            }).collect(),
        };
        
        // Step 6: Prepare debug data with full isochrones for frontend visualization
        let debug_data = Some(DebugData {
            geometric_centroid: (center.longitude, center.latitude),
            isochrones: Self::convert_isochrone_results_debug(&final_isochrones, locations),
            intersection_polygons: Self::convert_intersections_debug(&intersections),
            candidate_points: Self::convert_candidates_debug(&candidates),
            final_candidates: vec![DebugCandidate {
                id: "optimal".to_string(),
                coordinates: (optimal_point.longitude, optimal_point.latitude),
                source: "optimal".to_string(),
                score: None,
            }],
            isochrone_data: Some(Self::convert_isochrone_data_debug(&final_isochrones)),
        });
        
        let end_time = std::time::Instant::now();
        let duration = end_time.duration_since(start_time);
        info!("🕒 Total execution time: {:?}", duration);

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
            .map(|route| route.0.as_secs() as u32)
            .max()
            .unwrap_or(0);
        
        let avg_time_minutes = max_time_seconds / 60;
        let margin_time = avg_time_minutes as f64 * 1.2;
        let rounded_time_limit = ((margin_time as u32 + 4) / 5) * 5; // Rounds up to nearest 5
        let capped_time_limit = rounded_time_limit.min(90);
        
        info!("⏱️  Estimated travel time: {}min, margin: {}min, using time limit: {}min", avg_time_minutes, margin_time, capped_time_limit);
        Ok(capped_time_limit)
    }

    async fn find_optimal_isochrone_candidates(
        &self,
        locations: &[(String, Location)],
        initial_time_limit: u32,
    ) -> Result<(Vec<IsochroneResult>, Vec<Polygon<f64>>, Vec<Location>)> {
        const MIN_INTERSECTION_AREA_KM2: f64 = 0.1;  
        const MAX_INTERSECTION_AREA_KM2: f64 = 10.0; 
        const MAX_GENERATED_CANDIDATES: usize = 50;
        const MIN_TIME_LIMIT_MINUTES: u32 = 10;
        const MAX_TIME_LIMIT_MINUTES: u32 = 90;
        const TIME_LIMIT_INCREMENT_MINUTES: u32 = 5;

        let mut current_time_limit = initial_time_limit;
        let mut tried_results: std::collections::HashMap<u32, (Vec<IsochroneResult>, Vec<Polygon<f64>>, f64)> = std::collections::HashMap::new();
        
        loop {
            // Check for oscillation and return current result if detected
            if tried_results.contains_key(&current_time_limit) {
                info!("⚠️  Oscillation detected at {}min, using current result", current_time_limit);
                
                let current_result = &tried_results[&current_time_limit];
                let candidates = self.generate_candidates(&current_result.1)
                    .into_iter()
                    .take(MAX_GENERATED_CANDIDATES)
                    .collect::<Vec<_>>();
                
                if !candidates.is_empty() {
                    info!("🎯 Using oscillation result with area {:.2} km² and {} candidates", 
                          current_result.2, candidates.len());
                    return Ok((current_result.0.clone(), current_result.1.clone(), candidates));
                }
                break;
            }
            let isochrones = self.isochrone_service
                .get_isochrones(locations, current_time_limit, Some("pt".to_string()))
                .await?;

            if isochrones.is_empty() {
                info!("❌ No isochrones at {}min, increasing time limit", current_time_limit);
                current_time_limit = (current_time_limit + TIME_LIMIT_INCREMENT_MINUTES).min(MAX_TIME_LIMIT_MINUTES);
                continue;
            }

            let intersections = self.isochrone_service.get_isochrone_intersections(&isochrones);
            info!("🌐 {}min → {} isochrones → {} intersections", 
                  current_time_limit, isochrones.len(), intersections.len());

            if intersections.is_empty() {
                info!("❌ No intersections at {}min, increasing time limit", current_time_limit);
                current_time_limit = (current_time_limit + TIME_LIMIT_INCREMENT_MINUTES).min(MAX_TIME_LIMIT_MINUTES);
                continue;
            }

            let area_km2 = Self::calculate_total_area_km2(&intersections);
            
            tried_results.insert(current_time_limit, (isochrones.clone(), intersections.clone(), area_km2));
            
            match self.evaluate_area_fitness(area_km2, MIN_INTERSECTION_AREA_KM2, MAX_INTERSECTION_AREA_KM2) {
                AreaFitness::JustRight => {
                    let candidates = self.generate_candidates(&intersections)
                        .into_iter()
                        .take(MAX_GENERATED_CANDIDATES)
                        .collect::<Vec<_>>();
                    
                    if !candidates.is_empty() {
                        info!("🎯 Found optimal area ({:.2} km²) with {} candidates at {}min", 
                              area_km2, candidates.len(), current_time_limit);
                        return Ok((isochrones, intersections, candidates));
                    }
                },
                AreaFitness::TooLarge => {
                    info!("📏 Area too large ({:.2} km²), reducing time limit", area_km2);
                    current_time_limit = (current_time_limit.saturating_sub(TIME_LIMIT_INCREMENT_MINUTES)).max(MIN_TIME_LIMIT_MINUTES);
                },
                AreaFitness::TooSmall => {
                    info!("📏 Area too small ({:.2} km²), increasing time limit", area_km2);
                    current_time_limit = (current_time_limit + TIME_LIMIT_INCREMENT_MINUTES).min(MAX_TIME_LIMIT_MINUTES);
                }
            }
            
            if current_time_limit <= MIN_TIME_LIMIT_MINUTES || current_time_limit >= MAX_TIME_LIMIT_MINUTES {
                break;
            }
        }

        Err(anyhow::anyhow!("Could not find optimal intersection area within time limits {}-{}min", MIN_TIME_LIMIT_MINUTES, MAX_TIME_LIMIT_MINUTES))
    }

    fn evaluate_area_fitness(&self, area_km2: f64, min_area: f64, max_area: f64) -> AreaFitness {
        if area_km2 < min_area {
            AreaFitness::TooSmall
        } else if area_km2 > max_area {
            AreaFitness::TooLarge
        } else {
            AreaFitness::JustRight
        }
    }

    fn calculate_total_area_km2(intersections: &[Polygon<f64>]) -> f64 {
        intersections.iter()
            .map(|polygon| polygon.unsigned_area())
            .sum::<f64>() * 111.0 * 111.0
    }


    fn generate_candidates(&self, intersections: &[Polygon<f64>]) -> Vec<Location> {
        if intersections.is_empty() {
            return Vec::new();
        }

        let mut candidates: Vec<Location> = Vec::new();
        
        // Configuration
        let grid_spacing_degrees = 0.001; // ~100m at equator
        let area_threshold_km2 = 0.5; // 1 km²
        let area_threshold_degrees2 = area_threshold_km2 / (111.0 * 111.0); // Convert to degrees²
        
        // Separate polygons by size
        let mut large_polygons = Vec::new();
        let mut small_polygons = Vec::new();
        
        for polygon in intersections {
            let area = polygon.unsigned_area();
            if area >= area_threshold_degrees2 {
                large_polygons.push(polygon);
            } else {
                small_polygons.push(polygon);
            }
        }
        
        info!("🔍 Generating candidates: {} large polygons, {} small polygons", 
              large_polygons.len(), small_polygons.len());
        
        for polygon in large_polygons {
            let polygon_candidates = self.generate_candidates_large_polygon(polygon, grid_spacing_degrees);
            candidates.extend(polygon_candidates.clone());
            info!("📍 Generated {} candidates for large polygon", polygon_candidates.len());
        }
        
        if !small_polygons.is_empty() {
            let collective_candidates = self.generate_candidates_small_polygons(&small_polygons, grid_spacing_degrees);
            candidates.extend(collective_candidates.clone());
            info!("📍 Generated {} candidates for {} small polygons", collective_candidates.len(), small_polygons.len());
        }
        
        // Always include centroids as candidates (they're often good)
        for polygon in intersections {
            if let Some(centroid) = polygon.centroid() {
                candidates.push(Location::new(centroid.y(), centroid.x()));
            }
        }
        
        info!("🎯 Total candidates generated: {}", candidates.len());
        candidates
    }

    fn generate_candidates_large_polygon(&self, polygon: &Polygon<f64>, grid_spacing: f64) -> Vec<Location> {
        let mut candidates = Vec::new();
        
        if let Some(bounding_rect) = polygon.bounding_rect() {
            let min_x = bounding_rect.min().x;
            let max_x = bounding_rect.max().x;
            let min_y = bounding_rect.min().y;
            let max_y = bounding_rect.max().y;
            
            let mut y = min_y;
            while y <= max_y {
                let mut x = min_x;
                while x <= max_x {
                    let point = Point::new(x, y);
                    if polygon.contains(&point) {
                        candidates.push(Location::new(y, x));
                    }
                    x += grid_spacing;
                }
                y += grid_spacing;
            }
        }
        
        candidates
    }

    fn generate_candidates_small_polygons(&self, polygons: &[&Polygon<f64>], grid_spacing: f64) -> Vec<Location> {
        let mut candidates = Vec::new();
        
        // Calculate bounding box that encompasses all small polygons
        let mut min_x = f64::INFINITY;
        let mut max_x = f64::NEG_INFINITY;
        let mut min_y = f64::INFINITY;
        let mut max_y = f64::NEG_INFINITY;
        
        for polygon in polygons {
            if let Some(bounding_rect) = polygon.bounding_rect() {
                min_x = min_x.min(bounding_rect.min().x);
                max_x = max_x.max(bounding_rect.max().x);
                min_y = min_y.min(bounding_rect.min().y);
                max_y = max_y.max(bounding_rect.max().y);
            }
        }
        
        // Generate grid over the collective bounding box
        let mut y = min_y;
        while y <= max_y {
            let mut x = min_x;
            while x <= max_x {
                let point = Point::new(x, y);
                
                // Check if point is contained in any of the small polygons
                for polygon in polygons {
                    if polygon.contains(&point) {
                        candidates.push(Location::new(y, x));
                        break; // No need to check other polygons for this point
                    }
                }
                x += grid_spacing;
            }
            y += grid_spacing;
        }
        
        candidates
    }

    //For now, we only consider the minimal average travel time to the candidate
    async fn evaluate_candidates(&self, candidates: &[Location], locations: &[(String, Location)]) -> Result<(Location, Vec<Route>, Vec<u32>)> {
        if candidates.is_empty() {
            return Err(anyhow::anyhow!("No candidates to evaluate"));
        }

        let mut best_candidate = None;
        let mut best_avg_time = f64::INFINITY;
        let mut best_routes = Vec::new();
        let mut best_durations = Vec::new();


        for (candidate_idx, candidate) in candidates.iter().enumerate() {
            let route_results = self.route_service.get_transit_routes(locations, candidate).await;

            let travel_times: Vec<u32> = route_results.iter()
                .filter_map(|route| route.as_ref().ok())
                .map(|route| route.0.as_secs() as u32)
                .collect();

            if travel_times.len() != locations.len() {
                info!("⚠️  Candidate {} has {} failed routes, skipping", candidate_idx, locations.len() - travel_times.len());
                continue;
            }
            
            let avg_time_seconds = travel_times.iter().sum::<u32>() as f64 / travel_times.len() as f64;
            let avg_time_minutes = avg_time_seconds / 60.0;

            info!("📊 Candidate {}: avg={:.1}min", 
                candidate_idx, avg_time_minutes);

            if avg_time_seconds < best_avg_time {
                best_avg_time = avg_time_seconds;
                best_candidate = Some(candidate.clone());
                let mut routes = Vec::new();
                let mut durations = Vec::new();
                
                for (route_result, (id, _)) in route_results.iter().zip(locations.iter()) {
                    if let Ok((duration, _distance, steps)) = route_result {
                        routes.push(Route {
                            geometry: LineString::new(vec![]), // TODO: Add actual geometry
                            steps: steps.clone(),
                        });
                        durations.push(duration.as_secs() as u32);
                    }
                }
                
                best_routes = routes;
                best_durations = durations;
            }
        }

        match best_candidate {
            Some(candidate) => {
                info!("🏆 Selected candidate with average travel time: {:.1}min", best_avg_time / 60.0);
                Ok((candidate, best_routes, best_durations))
            },
            None => Err(anyhow::anyhow!("No valid candidates found after evaluation"))
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