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

pub struct IsochroneAlgorithm;

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
            .map(|(i, addr)| {
                let id = format!("addr_{}", i);
                let location = Location::new(addr.coordinates.unwrap().1, addr.coordinates.unwrap().0);
                (id, location)
            })
            .collect();

        if locations.len() < 2 {
            return Err(anyhow::anyhow!("At least two valid locations are required"));
        }

        // Progressive search: try different time limits until we find intersection
        let (meeting_point, actual_time_used) = Self::progressive_isochrone_search(
            &locations, 
            max_time, 
            &routing_profile
        ).await?;

        // Calculate routes to the meeting point
        let routes = Self::calculate_routes_to_meeting_point(
            &locations, 
            &meeting_point, 
            &routing_profile
        ).await?;

        // Build travel times from routes
        let travel_times: Vec<TravelTime> = routes.iter().map(|route| {
            let duration_minutes = if !route.steps.is_empty() {
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
    ) -> anyhow::Result<(Location, u32)> {
        // Smart time progression: start with realistic times for the profile
        let time_increments = match profile {
            "pt" | "public_transport" => vec![20, 30, 45, 60, 90],
            "foot" | "walking" => vec![15, 25, 40, 60],
            "car" => vec![10, 15, 25, 40],
            _ => vec![20, 35, 50, 75],
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
            
            // Try to find intersection
            if let Some(intersection) = Self::find_intersection(&isochrones) {
                info!("Found intersection at {} minutes", time_minutes);
                
                // Generate candidates within the intersection
                let candidates = Self::generate_candidates_in_intersection(&intersection, 8);
                
                if !candidates.is_empty() {
                    // Return the centroid of candidates as meeting point
                    let meeting_point = Self::select_best_candidate(&candidates);
                    return Ok((meeting_point, time_minutes));
                }
            }
        }
        
        // No intersection found, fall back to geometric centroid
        warn!("No isochrone intersection found, using geometric centroid");
        let geometric_center = Self::geometric_centroid_from_locations(locations);
        Ok((geometric_center, max_search_time))
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
                    Duration::from_secs(45), 
                    isochrone_service.compute_isochrone(&request)
                ).await {
                    Ok(Ok(isochrone)) => isochrone,
                    _ => {
                        warn!("Isochrone computation failed for {}, using geometric fallback", id);
                        isochrone_service.create_geometric_fallback(location, time_limit_seconds, profile)
                    }
                };
                
                // Cache the result (30 day TTL)
                let _ = cache_service.cache_isochrone(
                    location,
                    time_limit_seconds,
                    profile,
                    &result,
                    30
                ).await;
                
                Ok(result)
            }
        }).collect();

        let results = join_all(isochrone_futures).await;
        let isochrones: Result<Vec<_>, _> = results.into_iter().collect();
        isochrones
    }

    /// Find intersection of multiple isochrone polygons
    fn find_intersection(isochrones: &[IsochroneResult]) -> Option<Polygon<f64>> {
        if isochrones.is_empty() {
            return None;
        }

        if isochrones.len() == 1 {
            return Some(isochrones[0].polygon.clone());
        }

        // For 2 polygons, use simple intersection check
        if isochrones.len() == 2 {
            let poly1 = &isochrones[0].polygon;
            let poly2 = &isochrones[1].polygon;
            
            if poly1.intersects(poly2) {
                // Return the smaller polygon as approximate intersection
                if Self::polygon_area(poly1) < Self::polygon_area(poly2) {
                    return Some(poly1.clone());
                } else {
                    return Some(poly2.clone());
                }
            }
            return None;
        }

        // For 3+ polygons, check if all intersect with the first one
        let first_polygon = &isochrones[0].polygon;
        let all_intersect = isochrones.iter().skip(1).all(|iso| {
            first_polygon.intersects(&iso.polygon)
        });

        if all_intersect {
            // Return the smallest polygon as approximate intersection
            isochrones.iter()
                .min_by(|a, b| {
                    Self::polygon_area(&a.polygon)
                        .partial_cmp(&Self::polygon_area(&b.polygon))
                        .unwrap_or(std::cmp::Ordering::Equal)
                })
                .map(|iso| iso.polygon.clone())
        } else {
            None
        }
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

    /// Select the best candidate (for now, just return the centroid)
    fn select_best_candidate(candidates: &[Location]) -> Location {
        if candidates.is_empty() {
            return Location::new(0.0, 0.0);
        }
        
        if candidates.len() == 1 {
            return candidates[0].clone();
        }
        
        // Return geometric centroid of candidates
        let points: Vec<Point<f64>> = candidates.iter().map(|loc| loc.to_point()).collect();
        let multi_point = MultiPoint::new(points);
        let centroid = multi_point.centroid().unwrap();
        Location::new(centroid.y(), centroid.x())
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
                            3600
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