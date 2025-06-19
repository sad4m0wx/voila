use geo::{Point, MultiPoint, Polygon, Centroid, Area, BoundingRect, Contains};
use anyhow::Result;

use crate::models::{Location, MeetingPoint, DebugData, DebugCandidate, DebugIsochrone, DebugPolygon, Route, TravelTime};
use crate::models::geometry::LineString;
use crate::models::debug::{DebugIsochroneData, DebugHeatmapData, DebugOptimizationStats, DebugCandidateMovement, DebugBoundingBox, DebugPOI};

use crate::models::isochrone::IsochroneResult;
use crate::services::isochrone_service::IsochroneService;
use crate::services::route_service::RouteService;
use crate::services::poi_service::PoiService;
use log::info;

#[derive(Debug, PartialEq)]
enum AreaFitness {
    TooSmall,
    JustRight,
    TooLarge,
}

pub struct MeetingPointAlgorithm {
    isochrone_service: IsochroneService,
    route_service: RouteService,
    poi_service: PoiService,
    heatmap_data: std::sync::Arc<std::sync::Mutex<Option<DebugHeatmapData>>>,
}

impl MeetingPointAlgorithm {

    pub async fn new() -> Self {
        Self {
            isochrone_service: IsochroneService::new(),
            route_service: RouteService::new(),
            poi_service: PoiService::new().await,
            heatmap_data: std::sync::Arc::new(std::sync::Mutex::new(None)),
        }
    }

    pub async fn find_meeting_point(
        &self,
        locations: &[(String, Location)],
    ) -> Result<(Vec<MeetingPoint>, Vec<Vec<Route>>, Option<DebugData>)> {

        let start_time = std::time::Instant::now();

        // Step 1: Calculate geometric center
        let center = Self::calculate_centroid(locations);
        info!("📍 Geometric center: ({:.6}, {:.6})", center.latitude, center.longitude);
        
        // Step 2: Estimate time limit by computing travel time to centroid
        let time_limit_minutes = self.estimate_time_to_center(locations, &center).await?;
        info!("⏱️  Estimated time limit: {}min", time_limit_minutes);
        
        // Step 3: Get optimal isochrones with adaptive area control
        let (final_isochrones, intersections) = self
            .find_optimal_isochrones(locations, time_limit_minutes)
            .await?;
        
        if intersections.is_empty() {
            return Err(anyhow::anyhow!("No valid intersections found"));
        }

        info!("🌐 Generated {} isochrones with {} intersections", final_isochrones.len(), intersections.len());
        
        // Step 4: Generate and optimize candidates
        let candidates = self.generate_and_optimize_candidates(&intersections).await?;
        if candidates.is_empty() {
            return Err(anyhow::anyhow!("No valid candidates found"));
        }
        info!("🎯 Generated {} candidate points", candidates.len());
        
        // Step 5: Evaluate candidates and find optimal meeting points
        let (optimal_points, all_routes, all_durations) = self.evaluate_candidates(&candidates, locations).await?;
        
        // Step 6: Create meeting point results
        let mut meeting_points = Vec::new();
        let mut routes_per_point = Vec::new();
        
        for (i, ((optimal_point, routes), durations)) in optimal_points.iter().zip(all_routes.iter()).zip(all_durations.iter()).enumerate() {
            let meeting_point = MeetingPoint {
                name: if i == 0 { 
                    "Optimal Meeting Point".to_string() 
                } else { 
                    format!("Alternative Meeting Point {}", i + 1) 
                },
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
            
            meeting_points.push(meeting_point);
            routes_per_point.push(routes.clone());
        }
        
        // Step 7: Prepare debug data
        let debug_data = Some(DebugData {
            geometric_centroid: (center.longitude, center.latitude),
            isochrones: Self::convert_isochrones_debug(&final_isochrones),
            intersection_polygons: Self::convert_intersections_debug(&intersections),
            candidate_points: Self::convert_candidates_debug(&candidates),
            final_candidates: optimal_points.iter().enumerate().map(|(i, point)| DebugCandidate {
                id: if i == 0 { "optimal".to_string() } else { format!("alternative_{}", i) },
                coordinates: (point.longitude, point.latitude),
                source: if i == 0 { "optimal".to_string() } else { "alternative".to_string() },
                score: None,
            }).collect(),
            isochrone_data: Some(Self::convert_isochrone_data_debug(&final_isochrones)),
            heatmap_data: self.heatmap_data.lock().unwrap().clone(),
        });
        
        let end_time = std::time::Instant::now();
        let duration = end_time.duration_since(start_time);
        info!("🕒 Total execution time: {:?}", duration);

        Ok((meeting_points, routes_per_point, debug_data))
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
        let rounded_time_limit = ((avg_time_minutes as u32 + 4) / 5) * 5; // Rounds up to nearest 5
        let capped_time_limit = rounded_time_limit.min(90);
        
        info!("⏱️  Estimated travel time: {}min, using time limit: {}min", avg_time_minutes, capped_time_limit);
        Ok(capped_time_limit)
    }

    async fn find_optimal_isochrones(
        &self,
        locations: &[(String, Location)],
        initial_time_limit: u32,
    ) -> Result<(Vec<IsochroneResult>, Vec<Polygon<f64>>)> {
        const MIN_INTERSECTION_AREA_KM2: f64 = 2.5;  
        const MAX_INTERSECTION_AREA_KM2: f64 = 20.0;

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
                if !current_result.1.is_empty() {
                    info!("🎯 Using oscillation result with area {:.2} km²", current_result.2);
                    return Ok((current_result.0.clone(), current_result.1.clone()));
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
                    info!("🎯 Found optimal area ({:.2} km²) with {} intersections at {}min", area_km2, intersections.len(), current_time_limit);
                    return Ok((isochrones, intersections));
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

    async fn generate_and_optimize_candidates(&self, intersections: &[Polygon<f64>]) -> Result<Vec<Location>> {
        // Step 1: Generate grid candidates
        let grid_candidates = self.generate_grid_candidates(intersections);
        info!("🔍 Generated {} grid candidates", grid_candidates.len());
        
        if grid_candidates.is_empty() {
            return Ok(Vec::new());
        }

        // Step 2: Optimize candidates using gradient descent with heatmap
        let optimized_candidates = self.optimize_candidates_with_gradient_descent(&grid_candidates, intersections).await?;
        info!("🎯 Optimized to {} candidates using gradient descent", optimized_candidates.len());
        
        Ok(optimized_candidates)
    }

    fn generate_grid_candidates(&self, intersections: &[Polygon<f64>]) -> Vec<Location> {
        let mut candidates: Vec<Location> = Vec::new();
        let grid_spacing_degrees = 0.0015; // ~200m at equator
        
        for polygon in intersections {
            let polygon_candidates = self.generate_grid_for_polygon(polygon, grid_spacing_degrees);
            candidates.extend(polygon_candidates);
        }
        
        // Sort candidates for deterministic ordering
        candidates.sort_by(|a, b| {
            a.latitude.partial_cmp(&b.latitude)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| a.longitude.partial_cmp(&b.longitude)
                    .unwrap_or(std::cmp::Ordering::Equal))
        });
        
        candidates
    }

    fn generate_grid_for_polygon(&self, polygon: &Polygon<f64>, grid_spacing: f64) -> Vec<Location> {
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

        // Always include centroids as candidates (they're often good)
        if let Some(centroid) = polygon.centroid() {
            candidates.push(Location::new(centroid.y(), centroid.x()));
        }
    
        candidates
    }

    async fn optimize_candidates_with_gradient_descent(
        &self, 
        grid_candidates: &[Location], 
        intersections: &[Polygon<f64>]
    ) -> Result<Vec<Location>> {
        let mut optimized_candidates = Vec::new();
        let mut candidates_moved = 0;
        let mut total_movement_distance = 0.0;
        let mut candidate_movements = Vec::new();
        
        // Optimization parameters
        const MOVEMENT_INCREMENT: f64 = 0.001; // ~100m movement per iteration
        const MAX_ITERATIONS: usize = 5;
        const MIN_HEAT_THRESHOLD: f64 = 0.15;

        for original_candidate in grid_candidates {
            let mut current_location = original_candidate.clone();
            let mut best_location = original_candidate.clone();
            let mut best_heat = self.poi_service.get_location_heat(&current_location).await.unwrap_or(0.0);
            let original_heat = best_heat;

            // Gradient ascent toward local maxima
            for _iteration in 0..MAX_ITERATIONS {
                let mut improved = false;

                // Try moving in 8 directions
                for direction in 0..8 {
                    let angle = (direction as f64) * std::f64::consts::PI / 4.0; // 45-degree increments
                    let lat_offset = MOVEMENT_INCREMENT * angle.sin();
                    let lon_offset = MOVEMENT_INCREMENT * angle.cos();

                    let test_location = Location::new(
                        current_location.latitude + lat_offset,
                        current_location.longitude + lon_offset,
                    );

                    // Check if still within intersection polygons
                    let test_point = Point::new(test_location.longitude, test_location.latitude);
                    if !intersections.iter().any(|polygon| polygon.contains(&test_point)) {
                        continue;
                    }

                    let test_heat = self.poi_service.get_location_heat(&test_location).await.unwrap_or(0.0);
                    
                    if test_heat > best_heat {
                        best_heat = test_heat;
                        best_location = test_location;
                        improved = true;
                    }
                }

                if improved {
                    current_location = best_location.clone();
                } else {
                    break; // Local maximum found
                }
            }

            // Track movement statistics and debug data
            let movement_distance = original_candidate.distance_to(&best_location);
            let heat_improvement = best_heat - original_heat;
            let was_kept = best_heat >= MIN_HEAT_THRESHOLD;
            
            // Record movement for debug visualization
            candidate_movements.push(DebugCandidateMovement {
                original_position: (original_candidate.longitude, original_candidate.latitude),
                final_position: (best_location.longitude, best_location.latitude),
                movement_distance,
                heat_improvement,
                was_kept,
            });
            
            if movement_distance > 1.0 { 
                candidates_moved += 1;
                total_movement_distance += movement_distance;
            }

            // Only keep candidates with sufficient heat
            if was_kept {
                optimized_candidates.push(best_location);
            }
        }

        // Deduplicate candidates within 200m, keeping the best heat value
        const MIN_DISTANCE_METERS: f64 = 200.0;
        let final_candidates = self.deduplicate_candidates(&optimized_candidates, MIN_DISTANCE_METERS).await;

        // Generate and store heatmap debug data
        let heatmap_data = self.generate_heatmap_debug(intersections, &candidate_movements, grid_candidates.len(), final_candidates.len(), candidates_moved, total_movement_distance, MIN_HEAT_THRESHOLD).await?;
        *self.heatmap_data.lock().unwrap() = Some(heatmap_data);

        info!(
            "🎯 Gradient descent: {} → {} candidates (min heat: {:.2}), {} moved", 
            grid_candidates.len(), 
            final_candidates.len(), 
            MIN_HEAT_THRESHOLD,
            candidates_moved
        );

        Ok(final_candidates)
    }

    async fn deduplicate_candidates(&self, candidates: &[Location], min_distance: f64) -> Vec<Location> {
        let mut candidates_with_heat: Vec<(Location, f64)> = Vec::new();
        
        for candidate in candidates {
            let heat = self.poi_service.get_location_heat(candidate).await.unwrap_or(0.0);
            candidates_with_heat.push((candidate.clone(), heat));
        }

        // Sort by heat value (highest first)
        candidates_with_heat.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        let mut deduplicated = Vec::new();
        
        for (candidate, _heat) in candidates_with_heat {
            let too_close = deduplicated.iter().any(|existing: &Location| {
                candidate.distance_to(existing) < min_distance
            });
            
            if !too_close {
                deduplicated.push(candidate);
            }
        }

        //cap to 50
        deduplicated = deduplicated.into_iter().take(50).collect();

        deduplicated
    }

    async fn evaluate_candidates(&self, candidates: &[Location], locations: &[(String, Location)]) -> Result<(Vec<Location>, Vec<Vec<Route>>, Vec<Vec<u32>>)> {
        if candidates.is_empty() {
            return Err(anyhow::anyhow!("No candidates to evaluate"));
        }

        let mut candidate_results: Vec<(Location, Vec<Route>, Vec<u32>, f64)> = Vec::new();

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
            let std_dev_seconds = self.calculate_standard_deviation(&travel_times, avg_time_seconds);
            let heat_score = self.poi_service.get_location_heat(candidate).await.unwrap_or(0.0);
            
            let composite_score = self.calculate_composite_score(avg_time_seconds, std_dev_seconds, heat_score);
            
            info!("📊 Candidate {}: avg={:.1}min, std_dev={:.1}min, heat={:.3}, score={:.2}", 
                candidate_idx, avg_time_seconds / 60.0, std_dev_seconds / 60.0, heat_score, composite_score);

            let mut routes = Vec::new();
            let mut durations = Vec::new();
            
            for (route_result, (_id, _)) in route_results.iter().zip(locations.iter()) {
                if let Ok((duration, _distance, steps)) = route_result {
                    routes.push(Route {
                        geometry: LineString::new(vec![]),
                        steps: steps.clone(),
                    });
                    durations.push(duration.as_secs() as u32);
                }
            }
            
            candidate_results.push((candidate.clone(), routes, durations, composite_score));
        }

        if candidate_results.is_empty() {
            return Err(anyhow::anyhow!("No valid candidates found after evaluation"));
        }

        // Sort by composite score (lower is better)
        candidate_results.sort_by(|a, b| a.3.partial_cmp(&b.3).unwrap_or(std::cmp::Ordering::Equal));

        // Select top candidates with spatial diversity
        const MAX_CANDIDATES: usize = 3;
        const MIN_DISTANCE_KM: f64 = 1.0;
        
        let mut selected_candidates = Vec::new();
        
        for candidate in candidate_results.into_iter() {
            let candidate_location = &candidate.0;
            
            let too_close = selected_candidates.iter().any(|(selected_location, _, _, _)| {
                let distance_km = candidate_location.distance_to(selected_location) / 1000.0;
                distance_km < MIN_DISTANCE_KM
            });
            
            if !too_close {
                selected_candidates.push(candidate);
                if selected_candidates.len() >= MAX_CANDIDATES {
                    break;
                }
            }
        }
        
        let locations: Vec<Location> = selected_candidates.iter().map(|(loc, _, _, _)| loc.clone()).collect();
        let routes: Vec<Vec<Route>> = selected_candidates.iter().map(|(_, routes, _, _)| routes.clone()).collect();
        let durations: Vec<Vec<u32>> = selected_candidates.iter().map(|(_, _, durations, _)| durations.clone()).collect();

        info!("🏆 Selected {} candidates", locations.len());

        Ok((locations, routes, durations))
    }

    fn calculate_standard_deviation(&self, travel_times: &[u32], mean: f64) -> f64 {
        if travel_times.len() <= 1 {
            return 0.0;
        }
        
        let variance = travel_times.iter()
            .map(|&time| {
                let diff = time as f64 - mean;
                diff * diff
            })
            .sum::<f64>() / travel_times.len() as f64;
        
        variance.sqrt()
    }

    fn calculate_composite_score(&self, avg_time_seconds: f64, std_dev_seconds: f64, heat_score: f64) -> f64 {
        // Weights: average time, fairness (std dev), and heat score
        const AVG_TIME_WEIGHT: f64 = 0.40;   // 40% weight on average time
        const STD_DEV_WEIGHT: f64 = 0.40;    // 40% weight on standard deviation (fairness)
        const HEAT_WEIGHT: f64 = 0.20;       // 20% weight on heat score
        
        let avg_time_minutes = avg_time_seconds / 60.0;
        let std_dev_minutes = std_dev_seconds / 60.0;
        
        // Heat score penalty: higher heat = lower penalty
        let normalized_heat_penalty = (1.0 - heat_score) * 10.0; // Convert to 0-10 minute penalty
        
        AVG_TIME_WEIGHT * avg_time_minutes + 
        STD_DEV_WEIGHT * std_dev_minutes + 
        HEAT_WEIGHT * normalized_heat_penalty
    }

    // Debug data conversion functions
    fn convert_isochrones_debug(isochrones: &[IsochroneResult]) -> Vec<DebugIsochrone> {
        isochrones.iter().enumerate().map(|(i, isochrone)| {
            DebugIsochrone {
                origin_id: format!("location_{}", i + 1),
                time_limit_minutes: isochrone.time_limit_minutes as f64,
                area_km2: isochrone.polygon.unsigned_area() * 111.0 * 111.0,
                polygon: Self::polygon_to_debug(&format!("location_{}", i + 1), &isochrone.polygon),
            }
        }).collect()
    }


    async fn generate_heatmap_debug(
        &self,
        intersections: &[Polygon<f64>],
        candidate_movements: &[DebugCandidateMovement],
        original_candidates: usize,
        optimized_candidates: usize,
        candidates_moved: usize,
        total_movement_distance: f64,
        min_heat_threshold: f64,
    ) -> Result<DebugHeatmapData> {
        // Calculate bounding box for all intersections
        let mut min_lat = f64::INFINITY;
        let mut max_lat = f64::NEG_INFINITY;
        let mut min_lon = f64::INFINITY;
        let mut max_lon = f64::NEG_INFINITY;

        for polygon in intersections {
            if let Some(bbox) = polygon.bounding_rect() {
                min_lat = min_lat.min(bbox.min().y);
                max_lat = max_lat.max(bbox.max().y);
                min_lon = min_lon.min(bbox.min().x);
                max_lon = max_lon.max(bbox.max().x);
            }
        }

        // Add some padding to the bounding box
        let padding = 0.01; // ~1km padding
        let bounding_box = DebugBoundingBox {
            north: max_lat + padding,
            south: min_lat - padding,
            east: max_lon + padding,
            west: min_lon - padding,
        };

        // Generate heat grid
        const GRID_SIZE: usize = 50;
        let mut heat_values = vec![vec![0.0; GRID_SIZE]; GRID_SIZE];
        
        let lat_step = (bounding_box.north - bounding_box.south) / GRID_SIZE as f64;
        let lon_step = (bounding_box.east - bounding_box.west) / GRID_SIZE as f64;

        for i in 0..GRID_SIZE {
            for j in 0..GRID_SIZE {
                let lat = bounding_box.south + (i as f64) * lat_step;
                let lon = bounding_box.west + (j as f64) * lon_step;
                let location = Location::new(lat, lon);
                
                // Only calculate heat for points within intersections
                let point = Point::new(lon, lat);
                if intersections.iter().any(|polygon| polygon.contains(&point)) {
                    heat_values[i][j] = self.poi_service.get_location_heat(&location).await.unwrap_or(0.0);
                }
            }
        }

        // Get POI locations from the service for visualization
        let poi_locations = self.get_debug_poi_locations(&bounding_box).await;

        let optimization_stats = DebugOptimizationStats {
            original_candidates,
            optimized_candidates,
            candidates_moved,
            average_movement_distance: if candidates_moved > 0 {
                total_movement_distance / candidates_moved as f64
            } else {
                0.0
            },
            min_heat_threshold,
        };

        Ok(DebugHeatmapData {
            bounding_box,
            grid_size: GRID_SIZE,
            heat_values,
            poi_locations,
            optimization_stats,
            candidate_movements: candidate_movements.to_vec(),
        })
    }

    async fn get_debug_poi_locations(&self, bounding_box: &DebugBoundingBox) -> Vec<DebugPOI> {
        // For now, return empty list or sample data
        Vec::new()
    }

    fn convert_isochrone_data_debug(isochrones: &[IsochroneResult]) -> Vec<DebugIsochroneData> {
        isochrones.iter().enumerate().map(|(i, isochrone)| {
            DebugIsochroneData {
                origin_id: format!("location_{}", i + 1),
                location: (isochrone.location.longitude, isochrone.location.latitude),
                time_limit_minutes: isochrone.time_limit_minutes as f64,
                profile: isochrone.profile.clone(),
                polygon_area_km2: isochrone.polygon.unsigned_area() * 111.0 * 111.0,
                polygon_vertices: isochrone.polygon.exterior().coords().count(),
                algorithm_used: "simplified_algorithm".to_string(),
                computation_time_ms: 0,
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
                source: "grid_optimized".to_string(),
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