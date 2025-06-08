use geo::{Point, Centroid, MultiPoint, Polygon, Contains, BoundingRect, Area};
use anyhow::Result;

use crate::models::{Location, MeetingPoint, AddressInput, DebugData, DebugCandidate, DebugIsochrone, DebugPolygon, Route, LineString, TravelTime};
use crate::models::isochrone::IsochroneResult;
use crate::services::isochrone_service::IsochroneService;
use crate::services::graphhopper_client::GraphHopperClient;

pub struct MeetingPointAlgorithm;

#[derive(Debug, Clone)]
struct TimeOptimizationResult {
    optimal_time_limit: u32,
    confidence_score: f64,
}

#[derive(Debug, Clone)]
struct CandidateEvaluationResult {
    location: Location,
    max_travel_time: f64,  // This is what we want to minimize (minimax)
    avg_travel_time: f64,  // Used for tie-breaking
    minimax_score: f64,    // Primary score: max_time + small avg_time penalty
}

impl MeetingPointAlgorithm {
    /// Find optimal meeting point with parallel processing
    pub async fn find_meeting_point(
        addresses: &[AddressInput],
    ) -> Result<(MeetingPoint, Vec<Route>, Option<DebugData>)> {
        log::info!("🚀 Starting SPT + MINIMAX algorithm with {} addresses", addresses.len());
        let locations = Self::resolve_addresses(addresses).await?;
        
        // Step 1: Calculate geometric center and get realistic time bounds
        let center = Self::calculate_centroid(&locations);
        log::info!("📍 Geometric center: ({:.6}, {:.6})", center.latitude, center.longitude);
        
        let graphhopper = GraphHopperClient::new();
        let travel_times = graphhopper.batch_route_requests(&locations, &center).await;
        let time_limit = Self::calculate_time_limit(&travel_times);
        let max_time = travel_times.iter().copied().fold(0.0, f64::max);
        log::info!("🛣️  Travel times: {:?} for addresses {:?}", travel_times.iter().map(|t| t/60.0).collect::<Vec<f64>>(), locations.iter().map(|(id, _)| id.clone()).collect::<Vec<String>>());
        log::info!("⏱️  Time analysis: max={:.1}min, limit={:.1}min", max_time/60.0, time_limit as f64/60.0);
        
        // Step 2: Generate isochrones in parallel
        let isochrones = IsochroneService::batch_isochrone_requests(&locations, time_limit).await?;
        log::info!("🌐 Generated {} isochrones", isochrones.len());
        
        // Step 3: Find intersections and generate candidates
        let intersections = Self::find_intersections(&isochrones);
        let (candidates, debug_candidates) = Self::generate_candidates(&intersections, &center);
        log::info!("🎯 Found {} intersections, generated {} candidates", intersections.len(), candidates.len());
        
        // Step 4: Evaluate candidates and find optimal point
        let (best_location, routes, final_candidates) = Self::evaluate_candidates(&locations, &candidates, &graphhopper).await?;

        let meeting_point = MeetingPoint {
            name: "Optimal Meeting Point".to_string(),
            coordinates: (best_location.longitude, best_location.latitude),
            travel_times: Self::create_travel_times(&locations, &routes),
        };
        
        log::info!("🏆 Optimal meeting point: ({:.6}, {:.6})", best_location.latitude, best_location.longitude);
        log::info!("🛣️  Generated {} complete routes", routes.len());
        
        let debug_data = Some(DebugData {
            geometric_centroid: (center.longitude, center.latitude),
            isochrones: Self::convert_isochrones_debug(&isochrones, &locations),
            intersection_polygons: Self::convert_polygons_debug(&intersections),
            candidate_points: debug_candidates,
            final_candidates,
        });
        
        Ok((meeting_point, routes, debug_data))
    }

    /// Calculate geometric centroid of locations
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

    /// Calculate appropriate time limit based on travel times
    fn calculate_time_limit(travel_times: &[f64]) -> u32 {
        let max_time = travel_times.iter().copied().fold(0.0, f64::max);
        ((max_time * 1.2).max(600.0)) as u32 // 20% buffer, minimum 10 minutes
    }

    /// Find the actual geometric intersection between all isochrones
    /// This represents the area reachable from ALL locations within the time limit
    fn find_intersections(isochrones: &[IsochroneResult]) -> Vec<Polygon<f64>> {
        if isochrones.is_empty() {
            return Vec::new();
        }
        
        if isochrones.len() == 1 {
            return vec![isochrones[0].polygon.clone()];
        }

        log::info!("🔍 Computing intersection of {} isochrones", isochrones.len());
        
        // Start with the first polygon as the base intersection
        let mut intersection_result = isochrones[0].polygon.clone();
        let mut intersection_area = Self::polygon_area_km2(&intersection_result);
        
        log::debug!("Starting intersection area: {:.2} km²", intersection_area);
        
        // Intersect with each subsequent polygon
        for (i, isochrone) in isochrones.iter().enumerate().skip(1) {
            // For now, use geometric approximation by taking the smaller overlapping area
            if intersection_result.intersects(&isochrone.polygon) {
                // Choose the smaller polygon as intersection approximation
                let current_area = Self::polygon_area_km2(&isochrone.polygon);
                if current_area < intersection_area {
                    intersection_result = isochrone.polygon.clone();
                    intersection_area = current_area;
                }
                log::debug!("After intersecting with isochrone {}: area = {:.2} km²", i + 1, intersection_area);
            } else {
                // No intersection - return empty result
                log::warn!("⚠️  No intersection found between isochrones - using centroid fallback");
                return Vec::new();
            }
        }
        
        let final_area = Self::polygon_area_km2(&intersection_result);
        log::info!("✅ Final intersection area: {:.2} km²", final_area);
        
        vec![intersection_result]
    }

    /// Generate candidate points from intersections and center
    fn generate_candidates(
        intersections: &[Polygon<f64>],
        center: &Location,
    ) -> (Vec<Location>, Vec<DebugCandidate>) {
        let mut candidates = Vec::new();
        let mut debug_candidates = Vec::new();

        // Generate candidates from intersections
        for (i, intersection) in intersections.iter().enumerate() {
            let intersection_candidates = Self::sample_polygon_points(intersection, 3);
            
            for (j, candidate) in intersection_candidates.iter().enumerate() {
                debug_candidates.push(DebugCandidate {
                    id: format!("intersection_{}_{}", i, j),
                    coordinates: (candidate.longitude, candidate.latitude),
                    source: format!("intersection_{}", i),
                    score: None,
                });
            }
            candidates.extend(intersection_candidates);
        }

        // Add random candidates near center
        for i in 0..5 {
            let noisy_candidate = Self::add_random_offset(center, 1000.0);
            debug_candidates.push(DebugCandidate {
                id: format!("random_{}", i),
                coordinates: (noisy_candidate.longitude, noisy_candidate.latitude),
                source: "random".to_string(),
                score: None,
            });
            candidates.push(noisy_candidate);
        }

        // Always include the geometric center
        debug_candidates.push(DebugCandidate {
            id: "centroid".to_string(),
            coordinates: (center.longitude, center.latitude),
            source: "centroid".to_string(),
            score: None,
        });
        candidates.push(center.clone());

        // Limit total candidates
        candidates.truncate(12);
        debug_candidates.truncate(12);
        
        (candidates, debug_candidates)
    }

    /// Sample random points within a polygon
    fn sample_polygon_points(polygon: &Polygon<f64>, count: usize) -> Vec<Location> {
        let mut candidates = Vec::new();
        let mut rng = rand::thread_rng();
        
        if let Some(bbox) = polygon.bounding_rect() {
            let (min_x, max_x) = (bbox.min().x, bbox.max().x);
            let (min_y, max_y) = (bbox.min().y, bbox.max().y);
            
            let mut attempts = 0;
            while candidates.len() < count && attempts < count * 10 {
                let point = Point::new(
                    rng.gen_range(min_x..max_x),
                    rng.gen_range(min_y..max_y)
                );
                
                if polygon.contains(&point) {
                    candidates.push(Location::new(point.y(), point.x()));
                }
                attempts += 1;
            }
        }
        
        // Fallback to centroid if no points found
        if candidates.is_empty() {
            if let Some(centroid) = polygon.centroid() {
                candidates.push(Location::new(centroid.y(), centroid.x()));
            }
        }
        
        candidates
    }

    /// Evaluate candidates and find optimal meeting point
    async fn evaluate_candidates(
        locations: &[(String, Location)],
        candidates: &[Location],
        graphhopper: &GraphHopperClient,
    ) -> Result<(Location, Vec<crate::models::location::Route>, Vec<DebugCandidate>)> {
        if candidates.is_empty() {
            return Err(anyhow::anyhow!("No candidates provided"));
        }

        let total_routes = candidates.len() * locations.len();
        log::info!("📊 Evaluating {} candidates ({} routes) in parallel", candidates.len(), total_routes);
        
        // Evaluate all candidates at once
        let all_results = graphhopper.batch_evaluate_all_candidates(locations, candidates).await;
        
        let mut best_candidate = candidates[0].clone();
        let mut best_score = f64::INFINITY;
        let mut best_routes = Vec::new();
        let mut final_debug_candidates = Vec::new();
        
        for (i, (travel_times, routes)) in all_results.iter().enumerate() {
            let candidate = &candidates[i];
            let score = Self::calculate_candidate_score(travel_times);
            
            final_debug_candidates.push(DebugCandidate {
                id: format!("candidate_{}", i),
                coordinates: (candidate.longitude, candidate.latitude),
                source: "evaluation".to_string(),
                score: Some(score / 60.0), // Convert to minutes
            });
            
            if score < best_score {
                best_score = score;
                best_candidate = candidate.clone();
                best_routes = routes.clone();
                log::debug!("🌟 New best candidate {}: score={:.1}min", i + 1, score/60.0);
            }
        }
        
        log::info!("✅ Best candidate found with score {:.1}min", best_score/60.0);
        Ok((best_candidate, best_routes, final_debug_candidates))
    }

    /// Calculate candidate score based on travel times
    fn calculate_candidate_score(travel_times: &[f64]) -> f64 {
        let total_time: f64 = travel_times.iter().sum();
        let avg_time = total_time / travel_times.len() as f64;
        
        // Add fairness penalty for high variance
        let variance = travel_times.iter()
            .map(|&time| (time - avg_time).powi(2))
            .sum::<f64>() / travel_times.len() as f64;
        let fairness_penalty = variance.sqrt() * 0.2;
        
        total_time + fairness_penalty
    }

    /// Add random offset to a location
    fn add_random_offset(location: &Location, radius_meters: f64) -> Location {
        let mut rng = rand::thread_rng();
        let radius_deg = radius_meters / 111000.0;
        
        let angle: f64 = rng.gen_range(0.0..std::f64::consts::TAU);
        let distance: f64 = rng.gen_range(0.0..radius_deg);
        
        Location::new(
            location.latitude + distance * angle.cos(),
            location.longitude + distance * angle.sin(),
        )
    }

    /// Calculate polygon area in km²
    fn polygon_area_km2(polygon: &Polygon<f64>) -> f64 {
        let area_deg2 = polygon.unsigned_area();
        area_deg2 * 111.0 * 111.0 // Convert degrees² to km²
    }

    /// Resolve addresses to locations
    async fn resolve_addresses(addresses: &[AddressInput]) -> Result<Vec<(String, Location)>> {
        let mut locations = Vec::new();
        
        for addr in addresses {
            if let Some((lon, lat)) = addr.coordinates {
                let location = Location::new(lat, lon)
                    .with_address(addr.address.as_deref().unwrap_or("Unknown"));
                locations.push((addr.id.clone(), location));
            } else {
                return Err(anyhow::anyhow!("Coordinates required for address: {}", addr.id));
            }
        }
        
        Ok(locations)
    }

    /// Convert polygons to debug format
    fn convert_polygons_debug(polygons: &[Polygon<f64>]) -> Vec<DebugPolygon> {
        polygons.iter().enumerate().map(|(i, polygon)| {
            Self::polygon_to_debug(&format!("intersection_{}", i), polygon)
        }).collect()
    }

    /// Convert isochrones to debug format
    fn convert_isochrones_debug(
        isochrones: &[IsochroneResult], 
        locations: &[(String, Location)]
    ) -> Vec<DebugIsochrone> {
        isochrones.iter().enumerate().map(|(i, iso)| {
            let origin_id = locations.get(i)
                .map(|(id, _)| id.clone())
                .unwrap_or_else(|| format!("origin_{}", i));
            
            DebugIsochrone {
                origin_id,
                time_limit_minutes: iso.time_limit_seconds as f64 / 60.0,
                area_km2: Self::polygon_area_km2(&iso.polygon),
                polygon: Self::polygon_to_debug("isochrone", &iso.polygon),
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

    /// Create travel time summaries
    fn create_travel_times(
        locations: &[(String, Location)],
        routes: &[crate::models::location::Route],
    ) -> Vec<crate::models::location::TravelTime> {
        locations.iter().zip(routes.iter()).map(|((id, location), route)| {
            let duration_minutes = if !route.steps.is_empty() {
                route.steps.iter().map(|step| step.duration).sum::<u32>() / 60
            } else {
                // Estimate based on geometry
                let total_distance: f64 = route.geometry.coordinates.windows(2)
                    .map(|pair| {
                        let loc1 = Location::new(pair[0].1, pair[0].0);
                        let loc2 = Location::new(pair[1].1, pair[1].0);
                        loc1.distance_to(&loc2)
                    })
                    .sum();
                (total_distance / 7.0 / 60.0) as u32
            };

            crate::models::location::TravelTime {
                id: id.clone(),
                address: location.address.clone().unwrap_or_else(|| 
                    format!("{:.4}, {:.4}", location.latitude, location.longitude)
                ),
                duration: duration_minutes,
                distance: 0.0,
                estimated: route.steps.is_empty(),
                transit_summary: None,
            }
        }).collect()
    }
}