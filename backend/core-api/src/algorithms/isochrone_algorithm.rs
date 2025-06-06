use crate::models::location::{AddressInput, Location, MeetingPoint, TravelTime, Route, LineString};
use crate::models::isochrone::{IsochroneRequest, IsochroneResult};
use crate::services::isochrone_service::IsochroneService;
use crate::services::graphhopper_client::GraphHopperClient;
use crate::services::cache_service::cache;
use geo::{
    algorithm::{
        centroid::Centroid,
        contains::Contains,
        intersects::Intersects,
        bounding_rect::BoundingRect,
    },
    Point, Polygon,
};
use geo_types::MultiPoint;
use log::{info, warn};
use std::sync::Arc;
use futures::future::join_all;
use std::time::Duration;
use tokio::time::timeout;
use rand::Rng;
use std::time::Instant;
use anyhow::{anyhow, Result};

const ISOCHRONE_CACHE_TTL: u32 = 3600 * 24 * 30; // 30 days
const ROUTE_CACHE_TTL: u32 = 3600 * 24 * 30; // 30 days

pub struct IsochroneAlgorithm;

#[derive(Debug, Clone)]
struct CandidateScore {
    location: Location,
    routes: Vec<Route>,
    total_time: f64,
    max_time: f64,
    estimated_count: usize,
    score: f64,
    within_isochrones: bool,
}

impl IsochroneAlgorithm {
    /// Find meeting point using isochrone intersection analysis
    pub async fn find_meeting_point(
        addresses: &[AddressInput],
        max_time_minutes: Option<u32>,
        profile: Option<String>,
    ) -> anyhow::Result<(MeetingPoint, Vec<Route>)> {
        let routing_profile = profile.unwrap_or_else(|| "pt".to_string());
        let max_time = max_time_minutes.unwrap_or(60);

        info!("Starting isochrone algorithm for {} addresses", addresses.len());
        let start_time = Instant::now();

        // Convert addresses to locations
        let locations: Vec<(String, Location)> = addresses
            .iter()
            .enumerate()
            .filter_map(|(i, addr)| {
                addr.coordinates.map(|coords| {
                    let id = format!("addr_{}", i);
                    let location = Location::new(coords.1, coords.0) // lat, lng from lng, lat
                        .with_address(addr.address.clone().unwrap_or_default());
                    (id, location)
                })
            })
            .collect();

        if locations.len() < 2 {
            return Err(anyhow!("At least two valid locations are required"));
        }

        // Progressive search: try different time limits until we find intersection
        let (meeting_point, routes, actual_time_used) = Self::progressive_isochrone_search(
            &locations, 
            max_time, 
            &routing_profile
        ).await?;

        // Build travel times from routes with correct calculation
        let travel_times: Vec<TravelTime> = routes.iter().map(|route| {
            let duration_minutes = if !route.steps.is_empty() {
                // Steps duration is already in seconds, convert to minutes
                route.steps.iter().map(|step| step.duration).sum::<u32>() / 60
            } else {
                let location = locations.iter().find(|(id, _)| id == &route.id).unwrap().1.clone();
                let distance = location.distance_to(&meeting_point);
                Self::estimate_travel_time(distance, &routing_profile)
            };

            TravelTime {
                id: route.id.clone(),
                address: locations.iter()
                    .find(|(id, _)| id == &route.id)
                    .map(|(_, loc)| loc.address.clone().unwrap_or_default())
                    .unwrap_or_default(),
                duration: duration_minutes,
                distance: locations.iter()
                    .find(|(id, _)| id == &route.id)
                    .map(|(_, loc)| loc.distance_to(&meeting_point))
                    .unwrap_or(0.0),
                estimated: route.steps.is_empty(),
                transit_summary: Some(Self::get_profile_summary(&routing_profile)),
            }
        }).collect();

        let meeting_point_result = MeetingPoint {
            coordinates: (meeting_point.longitude, meeting_point.latitude),
            name: format!("Isochrone Meeting Point ({} min)", actual_time_used),
            travel_times,
        };

        info!("Isochrone algorithm completed successfully in {:?}", start_time.elapsed());
        Ok((meeting_point_result, routes))
    }

    /// Progressive search: start with reasonable time limits and increase until intersection found
    async fn progressive_isochrone_search(
        locations: &[(String, Location)],
        max_time_minutes: u32,
        profile: &str,
    ) -> anyhow::Result<(Location, Vec<Route>, u32)> {
        // Smart time progression: start with realistic times for the profile
        let time_increments = match profile {
            "pt" | "public_transport" => vec![15, 30, 45, 60, 90],
            "foot" | "walking" => vec![15, 30, 45, 60],
            _ => vec![20, 40, 60, 90],
        };

        let max_search_time = std::cmp::min(max_time_minutes, 90);
        
        for time_minutes in time_increments {
            if time_minutes > max_search_time {
                continue;
            }
            
            info!("Trying isochrone intersection with {} minutes", time_minutes);
            
            let time_seconds = time_minutes * 60;
            
            // Get or compute isochrones for all locations
            let isochrones = Self::get_or_compute_isochrones(locations, time_seconds, profile).await?;
            
            // Try to find intersection and evaluate candidates
            if let Some((meeting_point, routes)) = Self::find_best_meeting_point_in_isochrones(
                locations, 
                &isochrones, 
                time_minutes,
                profile
            ).await? {
                info!("Found valid meeting point at {} minutes", time_minutes);
                return Ok((meeting_point, routes, time_minutes));
            }
        }
        
        // No intersection found, fall back to geometric centroid with routes
        warn!("No isochrone intersection found, using geometric centroid");
        let geometric_center = Self::geometric_centroid_from_locations(locations);
        let routes = Self::calculate_routes_to_meeting_point(locations, &geometric_center, profile).await?;
        Ok((geometric_center, routes, max_search_time))
    }

    /// Find the best meeting point within isochrone intersections
    async fn find_best_meeting_point_in_isochrones(
        locations: &[(String, Location)],
        isochrones: &[IsochroneResult],
        time_limit_minutes: u32,
        profile: &str,
    ) -> anyhow::Result<Option<(Location, Vec<Route>)>> {
        // Find intersection areas
        let intersection_areas = Self::find_intersection_areas(isochrones);
        
        if intersection_areas.is_empty() {
            return Ok(None);
        }

        // Generate candidates in all intersection areas
        let mut all_candidates = Vec::new();
        for intersection in &intersection_areas {
            let candidates = Self::generate_candidates_in_intersection(intersection, 5);
            all_candidates.extend(candidates);
        }

        if all_candidates.is_empty() {
            return Ok(None);
        }

        // Evaluate all candidates
        let scored_candidates = Self::evaluate_candidates_with_isochrones(
            locations, 
            &all_candidates, 
            isochrones,
            time_limit_minutes,
            profile
        ).await?;

        // Select the best candidate that's actually within isochrones
        if let Some(best) = scored_candidates.into_iter()
            .filter(|c| c.within_isochrones)
            .min_by(|a, b| a.score.partial_cmp(&b.score).unwrap_or(std::cmp::Ordering::Equal)) {
            
            return Ok(Some((best.location, best.routes)));
        }

        Ok(None)
    }

    /// Find intersection areas between isochrones (improved logic)
    fn find_intersection_areas(isochrones: &[IsochroneResult]) -> Vec<Polygon<f64>> {
        if isochrones.len() < 2 {
            return isochrones.iter().map(|iso| iso.polygon.clone()).collect();
        }

        let mut intersections = Vec::new();

        // For 2 isochrones, check if they intersect
        if isochrones.len() == 2 {
            let poly1 = &isochrones[0].polygon;
            let poly2 = &isochrones[1].polygon;
            
            if poly1.intersects(poly2) {
                // Use the overlap area (approximated by the smaller polygon for now)
                // In a more sophisticated implementation, we'd compute the actual intersection
                if Self::polygon_area(poly1) < Self::polygon_area(poly2) {
                    intersections.push(poly1.clone());
                } else {
                    intersections.push(poly2.clone());
                }
            }
            return intersections;
        }

        // For 3+ isochrones, find pairwise intersections
        for i in 0..isochrones.len() {
            for j in (i + 1)..isochrones.len() {
                let poly1 = &isochrones[i].polygon;
                let poly2 = &isochrones[j].polygon;
                
                if poly1.intersects(poly2) {
                    // Check if this intersection also intersects with other polygons
                    let smaller_poly = if Self::polygon_area(poly1) < Self::polygon_area(poly2) {
                        poly1
                    } else {
                        poly2
                    };
                    
                    // Check if this intersection area also intersects with remaining polygons
                    let intersects_with_others = isochrones.iter()
                        .enumerate()
                        .filter(|(idx, _)| *idx != i && *idx != j)
                        .any(|(_, iso)| smaller_poly.intersects(&iso.polygon));
                    
                    if intersects_with_others || isochrones.len() == 2 {
                        intersections.push(smaller_poly.clone());
                    }
                }
            }
        }

        intersections
    }

    /// Evaluate candidates considering isochrone constraints
    async fn evaluate_candidates_with_isochrones(
        locations: &[(String, Location)],
        candidates: &[Location],
        isochrones: &[IsochroneResult],
        time_limit_minutes: u32,
        profile: &str,
    ) -> anyhow::Result<Vec<CandidateScore>> {
        let graphhopper = Arc::new(GraphHopperClient::new());
        let cache_service = cache().await;

        let candidate_futures: Vec<_> = candidates.iter().enumerate().map(|(i, candidate)| {
            let locations = locations.to_vec();
            let isochrones = isochrones.to_vec();
            let graphhopper = Arc::clone(&graphhopper);
            let cache_service = cache_service.clone();
            let candidate = candidate.clone();
            let profile = profile.to_string();
            
            async move {
                info!("Evaluating candidate {} within isochrones", i);
                
                // Check if candidate is within all isochrones
                let within_isochrones = isochrones.iter().all(|iso| {
                    let point = Point::new(candidate.longitude, candidate.latitude);
                    iso.polygon.contains(&point)
                });

                // Compute routes from all origins to this candidate
                let route_futures: Vec<_> = locations.clone().into_iter().map(|(id, origin)| {
                    let candidate = candidate.clone();
                    let graphhopper = Arc::clone(&graphhopper);
                    let cache_service = cache_service.clone();
                    let profile = profile.clone();
                    
                    async move {
                        // Check cache first
                        if let Some(cached_route) = cache_service.get_nearby_route(
                            &origin,
                            &candidate,
                            &profile,
                            200.0
                        ).await {
                            return (id, cached_route, false);
                        }

                        // Compute route with timeout
                        let route_result = timeout(
                            Duration::from_secs(60),
                            Self::compute_route(&graphhopper, &origin, &candidate, &profile)
                        ).await;

                        match route_result {
                            Ok(Ok((steps, geometry))) => {
                                let route = Route {
                                    id: id.clone(),
                                    geometry: LineString::new(geometry),
                                    steps,
                                };
                                
                                let _ = cache_service.cache_route(
                                    &origin,
                                    &candidate,
                                    &profile,
                                    &route,
                                    ROUTE_CACHE_TTL
                                ).await;
                                
                                (id, route, false)
                            }
                            _ => {
                                // Use geometric fallback
                                let route = Route {
                                    id: id.clone(),
                                    geometry: LineString::new(vec![
                                        (origin.longitude, origin.latitude),
                                        (candidate.longitude, candidate.latitude),
                                    ]),
                                    steps: vec![],
                                };
                                
                                (id, route, true)
                            }
                        }
                    }
                }).collect();

                let route_results = join_all(route_futures).await;
                
                // Calculate score for this candidate
                let mut total_time = 0.0;
                let mut max_time: f64 = 0.0;
                let mut estimated_count = 0;
                let mut routes = Vec::new();

                for (id, route, is_estimated) in route_results {
                    let duration_minutes = if !route.steps.is_empty() {
                        route.steps.iter().map(|step| step.duration).sum::<u32>() as f64 / 60.0
                    } else {
                        let origin = locations.iter().find(|(origin_id, _)| origin_id == &id).unwrap().1.clone();
                        let distance = origin.distance_to(&candidate);
                        Self::estimate_travel_time(distance, &profile) as f64
                    };

                    total_time += duration_minutes;
                    max_time = max_time.max(duration_minutes);
                    
                    if is_estimated {
                        estimated_count += 1;
                    }
                    
                    routes.push(route);
                }

                // Score calculation with isochrone compliance bonus
                let avg_time = total_time / routes.len() as f64;
                let estimation_penalty = estimated_count as f64 * 5.0;
                let max_time_penalty = (max_time - avg_time) * 0.3;
                let time_limit_penalty = if max_time > time_limit_minutes as f64 { 
                    (max_time - time_limit_minutes as f64) * 2.0 
                } else { 
                    0.0 
                };
                let isochrone_bonus = if within_isochrones { -10.0 } else { 20.0 };
                
                let score = avg_time + estimation_penalty + max_time_penalty + time_limit_penalty + isochrone_bonus;

                CandidateScore {
                    location: candidate,
                    routes,
                    total_time,
                    max_time,
                    estimated_count,
                    score,
                    within_isochrones,
                }
            }
        }).collect();

        let scored_candidates = join_all(candidate_futures).await;
        Ok(scored_candidates)
    }

    /// Get or compute isochrones, using cache when possible
    async fn get_or_compute_isochrones(
        locations: &[(String, Location)],
        time_limit_seconds: u32,
        profile: &str,
    ) -> anyhow::Result<Vec<IsochroneResult>> {
        let cache_service = cache().await;
        let isochrone_service = IsochroneService::new();
        
        let isochrone_futures: Vec<_> = locations.iter().map(|(id, location)| {
            let cache_service = cache_service.clone();
            let isochrone_service = &isochrone_service;
            let id = id.clone();
            
            async move {
                // Check cache first (500m radius)
                if let Some(cached) = cache_service.get_nearby_isochrone(
                    location, 
                    time_limit_seconds, 
                    profile, 
                    500.0
                ).await {
                    info!("Cache hit for isochrone: {}", id);
                    return Ok(cached);
                }
                
                // Compute new isochrone
                info!("Computing new isochrone for: {}", id);
                let request = IsochroneRequest {
                    point: location.clone(),
                    time_limit: Some(time_limit_seconds),
                    profile: Some(profile.to_string()),
                    ..Default::default()
                };
                
                let result = match timeout(
                    Duration::from_secs(60), 
                    isochrone_service.compute_isochrone(&request)
                ).await {
                    Ok(Ok(isochrone)) => {
                        // Cache successful API results
                        let _ = cache_service.cache_isochrone(
                            location,
                            time_limit_seconds,
                            profile,
                            &isochrone,
                            ISOCHRONE_CACHE_TTL
                        ).await;
                        isochrone
                    },
                    _ => {
                        warn!("Isochrone computation failed for {}, using geometric fallback (NOT CACHED)", id);
                        // Don't cache fallback results - let them be recomputed
                        isochrone_service.create_geometric_fallback(location, time_limit_seconds, profile)
                    }
                };
                
                Ok(result)
            }
        }).collect();

        let results = join_all(isochrone_futures).await;
        let isochrones: Result<Vec<_>, _> = results.into_iter().collect();
        isochrones
    }

    /// Generate candidate points within the intersection polygon
    fn generate_candidates_in_intersection(intersection: &Polygon<f64>, count: usize) -> Vec<Location> {
        let mut candidates = Vec::new();
        let mut rng = rand::thread_rng();
        
        // Get bounding box of the intersection
        let bbox = intersection.bounding_rect().unwrap();
        let min_x = bbox.min().x;
        let max_x = bbox.max().x;
        let min_y = bbox.min().y;
        let max_y = bbox.max().y;
        
        // Generate random points within bounding box and check if they're inside polygon
        let mut attempts = 0;
        while candidates.len() < count && attempts < count * 10 {
            let x = rng.gen_range(min_x..max_x);
            let y = rng.gen_range(min_y..max_y);
            let point = Point::new(x, y);
            
            if intersection.contains(&point) {
                candidates.push(Location::new(y, x)); // Note: lat, lng order
            }
            attempts += 1;
        }
        
        // If we couldn't generate enough random points, add the centroid
        if candidates.is_empty() {
            if let Some(centroid) = intersection.centroid() {
                candidates.push(Location::new(centroid.y(), centroid.x()));
            }
        }
        
        candidates
    }

    /// Calculate routes from each location to the meeting point
    async fn calculate_routes_to_meeting_point(
        locations: &[(String, Location)],
        meeting_point: &Location,
        profile: &str,
    ) -> anyhow::Result<Vec<Route>> {
        let graphhopper = Arc::new(GraphHopperClient::new());
        let cache_service = cache().await;
        
        let route_futures: Vec<_> = locations.iter().map(|(id, location)| {
            let meeting_point = meeting_point.clone();
            let graphhopper = Arc::clone(&graphhopper);
            let cache_service = cache_service.clone();
            let id = id.clone();
            let profile = profile.to_string();
            
            async move {
                // Check route cache first (200m radius)
                if let Some(cached_route) = cache_service.get_nearby_route(
                    location,
                    &meeting_point,
                    &profile,
                    200.0
                ).await {
                    info!("Cache hit for route: {}", id);
                    return Route {
                        id,
                        geometry: cached_route.geometry,
                        steps: cached_route.steps,
                    };
                }
                
                // Compute new route
                let route_result = timeout(
                    Duration::from_secs(15),
                    Self::compute_route(&graphhopper, location, &meeting_point, &profile)
                ).await;

                let route = match route_result {
                    Ok(Ok((steps, geometry))) => {
                        let route = Route {
                            id: id.clone(),
                            geometry: LineString::new(geometry),
                            steps,
                        };
                        
                        // Cache the route (1 hour TTL)
                        let _ = cache_service.cache_route(
                            location,
                            &meeting_point,
                            &profile,
                            &route,
                            ROUTE_CACHE_TTL
                        ).await;
                        
                        route
                    }
                    _ => {
                        // Fallback to simple geometry
                        Route {
                            id: id.clone(),
                            geometry: LineString::new(vec![
                                (location.longitude, location.latitude),
                                (meeting_point.longitude, meeting_point.latitude),
                            ]),
                            steps: vec![],
                        }
                    }
                };
                
                route
            }
        }).collect();

        let routes = join_all(route_futures).await;
        Ok(routes)
    }

    /// Compute route using GraphHopper
    async fn compute_route(
        graphhopper: &GraphHopperClient,
        from: &Location,
        to: &Location,
        profile: &str,
    ) -> anyhow::Result<(Vec<crate::models::transit::TransitStep>, Vec<(f64, f64)>)> {
        match profile {
            "pt" | "public_transport" => {
                let (_, _, steps) = graphhopper.get_transit_route(from, to).await?;
                let geometry = Self::extract_geometry_from_steps(&steps, from, to);
                Ok((steps, geometry))
            }
            _ => {
                // For other profiles, return simple geometry for now
                let geometry = vec![
                    (from.longitude, from.latitude),
                    (to.longitude, to.latitude),
                ];
                Ok((vec![], geometry))
            }
        }
    }

    /// Extract geometry from transit steps
    fn extract_geometry_from_steps(
        steps: &[crate::models::transit::TransitStep],
        from: &Location,
        to: &Location,
    ) -> Vec<(f64, f64)> {
        if steps.is_empty() {
            return vec![
                (from.longitude, from.latitude),
                (to.longitude, to.latitude),
            ];
        }

        let mut geometry = vec![(from.longitude, from.latitude)];
        
        for step in steps {
            if let Some(ref geom) = step.geometry {
                for coord_pair in &geom.coordinates {
                    if coord_pair.len() >= 2 {
                        geometry.push((coord_pair[0], coord_pair[1]));
                    }
                }
            }
        }
        
        geometry.push((to.longitude, to.latitude));
        geometry
    }

    /// Calculate geometric centroid from locations
    fn geometric_centroid_from_locations(locations: &[(String, Location)]) -> Location {
        let points: Vec<Point<f64>> = locations
            .iter()
            .map(|(_, location)| location.to_point())
            .collect();

        let multi_point = MultiPoint::new(points);
        let centroid_point = multi_point.centroid().unwrap();
        Location::new(centroid_point.y(), centroid_point.x())
    }

    /// Estimate travel time based on distance and profile
    fn estimate_travel_time(distance_meters: f64, profile: &str) -> u32 {
        let speed_kmh = match profile {
            "foot" | "walking" => 5.0,
            "bike" | "cycling" => 15.0,
            "car" => 30.0,
            "pt" | "public_transport" => 20.0,
            _ => 20.0,
        };
        
        let distance_km = distance_meters / 1000.0;
        let time_hours = distance_km / speed_kmh;
        (time_hours * 60.0).round() as u32
    }

    /// Get profile summary for display
    fn get_profile_summary(profile: &str) -> String {
        match profile {
            "foot" | "walking" => "🚶 Walking".to_string(),
            "bike" | "cycling" => "🚴 Cycling".to_string(),
            "car" => "🚗 Driving".to_string(),
            "pt" | "public_transport" => "🚌 Public Transport".to_string(),
            _ => format!("🚶 {}", profile),
        }
    }

    /// Calculate approximate polygon area
    fn polygon_area(polygon: &Polygon<f64>) -> f64 {
        use geo::algorithm::area::Area;
        polygon.unsigned_area()
    }
}