use crate::models::location::{AddressInput, Location, MeetingPoint, TravelTime, LineString, Route};
use crate::models::isochrone::{IsochroneRequest, IsochroneResult};
use crate::services::isochrone_service::IsochroneService;
use crate::services::graphhopper_client::GraphHopperClient;
use geo::algorithm::centroid::Centroid;
use geo::algorithm::intersects::Intersects;
use geo::Point;
use geo_types::MultiPoint;
use log::{info, warn, debug};
use std::sync::Arc;
use futures::future::join_all;
use std::time::Duration;
use tokio::time::timeout;

pub struct IsochroneMeetingPointFinder;

impl IsochroneMeetingPointFinder {
    /// Find optimal meeting point using progressive isochrone intersection analysis
    /// Starts with 10 minutes and increases by 10-minute increments up to 60 minutes max
    pub async fn find_optimal_meeting_point(
        addresses: &[AddressInput],
        max_travel_time_minutes: Option<u32>,
        profile: Option<String>,
    ) -> anyhow::Result<(MeetingPoint, Vec<Route>)> {
        let routing_profile = profile.clone().unwrap_or_else(|| "pt".to_string());
        let max_time = max_travel_time_minutes.unwrap_or(60);


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

        let max_time_minutes = max_travel_time_minutes.unwrap_or(90); // Default max 60 minutes
        let routing_profile = profile.clone().unwrap_or_else(|| "pt".to_string()); // Default to public transport

        let (meeting_point, actual_time_used) = Self::find_meeting_point_with_progressive_search(
            &locations, max_time, &routing_profile
        ).await?;

        // Calculate actual routes to the meeting point
        let routes = Self::calculate_routes_to_meeting_point(&locations, &meeting_point, &routing_profile).await?;

        let travel_times: Vec<TravelTime> = routes.iter().map(|route| {
            let duration_minutes = if !route.steps.is_empty() {
                // Sum up step durations if available
                route.steps.iter()
                    .map(|step| step.duration)
                    .sum::<u32>() / 60 // Convert to minutes
            } else {
                // Estimate based on distance and profile
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
            name: format!("Optimal Meeting Point ({} min travel time)", actual_time_used),
            travel_times,
        };

        Ok((meeting_point_result, routes))
    }

    /// Progressive isochrone search: starts at 10 minutes, increases by 10 until max or intersection found
    async fn find_meeting_point_with_progressive_search(
        locations: &[(String, Location)],
        max_time_minutes: u32,
        profile: &str,
    ) -> anyhow::Result<(Location, u32)> {
        let isochrone_service = IsochroneService::new();
        
        // Smarter progressive search: start with larger increments for efficiency
        let max_search_time = std::cmp::min(max_time_minutes, 90);
        
        // Use adaptive time increments: start with 20min, then 30, 45, 60
        // This reduces API calls from 4 to 3 in most cases
        let time_increments = if max_search_time <= 30 {
            vec![15, 30]
        } else if max_search_time <= 45 {
            vec![20, 35, 45]
        } else {
            vec![25, 40, 60, 90]
        };
        
        for time_minutes in time_increments {
            if time_minutes > max_search_time {
                continue;
            }
            
            info!("Trying isochrone search with {} minutes travel time", time_minutes);
            
            let time_seconds = time_minutes * 60;
            
            // Compute isochrones for all locations at this time limit IN PARALLEL
            let isochrone_futures: Vec<_> = locations.iter().map(|(id, location)| {
                let request = IsochroneRequest {
                    point: location.clone(),
                    time_limit: Some(time_seconds),
                    distance_limit: None,
                    profile: Some(profile.to_string()),
                    buckets: Some(1),
                    reverse_flow: Some(false),
                };
                
                let service = &isochrone_service;
                let id = id.clone();
                
                async move {
                    // Add timeout per isochrone to prevent hanging
                    match timeout(Duration::from_secs(60), service.get_isochrone_with_fallback(&request)).await {
                        Ok(result) => (id, result),
                        Err(_) => {
                            warn!("Isochrone computation timed out for {}, using fallback", id);
                            let fallback = service.create_geometric_fallback(&request.point, time_seconds, profile);
                            (id, fallback)
                        }
                    }
                }
            }).collect();

            let isochrone_results = join_all(isochrone_futures).await;
            
            // Try to find intersection
            match Self::try_find_isochrone_intersection(&isochrone_results) {
                Ok(meeting_point) => {
                    info!("Found valid intersection at {} minutes travel time", time_minutes);
                    return Ok((meeting_point, time_minutes));
                }
                Err(_) => {
                    info!("No intersection found at {} minutes, trying next increment", time_minutes);
                    continue;
                }
            }
        }
        
        // If no intersection found even at max time, fall back to geometric centroid
        warn!("No isochrone intersection found up to {} minutes, using geometric fallback", max_search_time);
        let geometric_center = Self::geometric_centroid_from_locations(locations);
        Ok((geometric_center, max_search_time))
    }

    /// Try to find intersection, returns error if no valid intersection exists
    fn try_find_isochrone_intersection(isochrone_results: &[(String, IsochroneResult)]) -> anyhow::Result<Location> {
        if isochrone_results.is_empty() {
            return Err(anyhow::anyhow!("No isochrone results available"));
        }

        if isochrone_results.len() == 1 {
            // Single location - use its centroid
            let polygon = &isochrone_results[0].1.polygon;
            let centroid = polygon.centroid().unwrap();
            return Ok(Location::new(centroid.y(), centroid.x()));
        }

        // For 2 locations: find intersection or closest points
        if isochrone_results.len() == 2 {
            let poly1 = &isochrone_results[0].1.polygon;
            let poly2 = &isochrone_results[1].1.polygon;
            
            if poly1.intersects(poly2) {
                // Use geometric centroid of both polygons as approximation
                let centroid1 = poly1.centroid().unwrap();
                let centroid2 = poly2.centroid().unwrap();
                let avg_lat = (centroid1.y() + centroid2.y()) / 2.0;
                let avg_lng = (centroid1.x() + centroid2.x()) / 2.0;
                return Ok(Location::new(avg_lat, avg_lng));
            } else {
                return Err(anyhow::anyhow!("No intersection found between two polygons"));
            }
        }

        // For 3+ locations: check if all polygons have a common intersection area
        let first_polygon = &isochrone_results[0].1.polygon;
        let mut all_intersect = true;
        
        // Quick check: do all polygons intersect with the first one?
        for (id, result) in isochrone_results.iter().skip(1) {
            if !first_polygon.intersects(&result.polygon) {
                debug!("No intersection found with {}", id);
                all_intersect = false;
                break;
            }
        }
        
        if all_intersect {
            // All polygons intersect - use centroid of all polygon centroids as approximation
            let centroids: Vec<Point<f64>> = isochrone_results
                .iter()
                .map(|(_, result)| result.polygon.centroid().unwrap())
                .collect();
            
            let avg_lat = centroids.iter().map(|p| p.y()).sum::<f64>() / centroids.len() as f64;
            let avg_lng = centroids.iter().map(|p| p.x()).sum::<f64>() / centroids.len() as f64;
            
            info!("Found intersection area, using centroid of {} polygons", isochrone_results.len());
            Ok(Location::new(avg_lat, avg_lng))
        } else {
            Err(anyhow::anyhow!("No common intersection found among all polygons"))
        }
    }

    /// Calculate geometric centroid from location coordinates as final fallback
    fn geometric_centroid_from_locations(locations: &[(String, Location)]) -> Location {
        let points: Vec<Point<f64>> = locations
            .iter()
            .map(|(_, location)| location.to_point())
            .collect();

        let multi_point = MultiPoint::new(points);
        let centroid_point = multi_point.centroid().unwrap();
        Location::new(centroid_point.y(), centroid_point.x())
    }

    /// Calculate actual routes from each location to the meeting point
    async fn calculate_routes_to_meeting_point(
        locations: &[(String, Location)],
        meeting_point: &Location,
        profile: &str,
    ) -> anyhow::Result<Vec<Route>> {
        let graphhopper = Arc::new(GraphHopperClient::new());
        
        let route_futures: Vec<_> = locations.iter().map(|(id, location)| {
            let meeting_point = meeting_point.clone();
            let graphhopper = Arc::clone(&graphhopper);
            let id = id.clone();
            let profile = profile.to_string();
            
            async move {
                // Try to get actual route
                let route_result = timeout(
                    Duration::from_secs(15),
                    Self::get_route_for_profile(&graphhopper, location, &meeting_point, &profile)
                ).await;

                match route_result {
                    Ok(Ok((steps, geometry))) => {
                        Route {
                            id,
                            geometry: LineString::new(geometry),
                            steps,
                        }
                    }
                    _ => {
                        // Fallback to simple geometry
                        Route {
                            id,
                            geometry: LineString::new(vec![
                                (location.longitude, location.latitude),
                                (meeting_point.longitude, meeting_point.latitude),
                            ]),
                            steps: vec![],
                        }
                    }
                }
            }
        }).collect();

        let routes = join_all(route_futures).await;
        Ok(routes)
    }

    /// Get route based on profile type
    async fn get_route_for_profile(
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
                // For other profiles (car, foot, bike), we'd need to implement those routes
                // For now, return simple geometry
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
        
        // Extract coordinates from step geometry if available
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

    /// Estimate travel time based on distance and profile
    fn estimate_travel_time(distance_meters: f64, profile: &str) -> u32 {
        let speed_kmh = match profile {
            "foot" | "walking" => 5.0,
            "bike" | "cycling" => 15.0,
            "car" => 30.0, // City driving
            "pt" | "public_transport" => 20.0,
            _ => 20.0,
        };
        
        let distance_km = distance_meters / 1000.0;
        let time_hours = distance_km / speed_kmh;
        (time_hours * 60.0).round() as u32 // Convert to minutes
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
} 