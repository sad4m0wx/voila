use crate::models::location::{AddressInput, Location, MeetingPoint, TravelTime, LineString, Route};
use crate::services::graphhopper_client::GraphHopperClient;
use geo::algorithm::centroid::Centroid;
use geo_types::{MultiPoint, Point};
use log::{debug, info};
use std::time::Duration;
use chrono::Utc;

pub struct MeetingPointFinder;

impl MeetingPointFinder {
    pub async fn find_optimal_meeting_point(
        addresses: &[AddressInput],
        departure_time: Option<i64>,
    ) -> anyhow::Result<(MeetingPoint, Vec<Route>)> {
        // Validate input
        if addresses.len() < 2 {
            return Err(anyhow::anyhow!("At least two addresses are required"));
        }

        // Convert addresses to locations
        let locations: Vec<(String, Location)> = addresses
            .iter()
            .filter_map(|addr| {
                addr.coordinates.map(|coords| {
                    (
                        addr.id.clone(),
                        Location::new(coords.1, coords.0)
                            .with_address(addr.address.clone().unwrap_or_default()),
                    )
                })
            })
            .collect();

        if locations.len() < 2 {
            return Err(anyhow::anyhow!("At least two valid locations are required"));
        }

        // Start with a simple geometric center (centroid)
        let centroid = Self::find_centroid(&locations);
        info!("Initial centroid: {:?}", centroid);

        // Find POIs near the centroid that could serve as good meeting points
        // (in a real implementation, you'd query for transit stations, cafes, etc.)
        let candidate_points = Self::generate_candidate_points(&centroid);
        info!("Generated {} candidate points", candidate_points.len());

        let graphhopper = GraphHopperClient::new();
        let departure = departure_time.map(|ts| 
            chrono::DateTime::<Utc>::from_timestamp(ts, 0).unwrap()
        );

        let mut best_point = centroid.clone();
        let mut best_score = f64::MAX;
        let mut best_travel_times = Vec::new();
        let mut best_routes = Vec::new();

        for candidate in candidate_points {
            let mut total_time = 0.0;
            let mut travel_times = Vec::new();
            let mut routes = Vec::new();

            for (id, location) in &locations {
                match graphhopper.get_transit_route(location, &candidate, departure).await {
                    Ok((duration, distance, steps)) => {
                        let duration_minutes = duration.as_secs() as f64 / 60.0;
                        total_time += duration_minutes;

                        // Create transit summary
                        let transit_summary = if steps.iter().any(|s| s.mode == "transit") {
                            steps.iter()
                                .filter(|s| s.mode == "transit" && s.transit_details.is_some())
                                .map(|s| {
                                    if let Some(details) = &s.transit_details {
                                        format!("{} {}", 
                                            Self::get_transit_icon(&details.line.vehicle_type),
                                            details.line.short_name.as_deref().unwrap_or(&details.line.name)
                                        )
                                    } else {
                                        String::new()
                                    }
                                })
                                .collect::<Vec<_>>()
                                .join(", ")
                        } else {
                            "🚶 Walking".to_string()
                        };

                        travel_times.push(TravelTime {
                            id: id.clone(),
                            address: location.address.clone().unwrap_or_default(),
                            duration: duration_minutes.round() as u32,
                            distance,
                            estimated: false,
                            transit_summary: Some(transit_summary),
                        });

                        // Create route with steps
                        let route = Route {
                            id: id.clone(),
                            geometry: LineString::new(
                                Self::extract_route_geometry(&steps, location, &candidate)
                            ),
                            steps,
                        };
                        routes.push(route);
                    }
                    Err(_) => {
                        // Fallback to direct distance if transit routing fails
                        let distance = location.distance_to(&candidate);
                        let avg_speed_ms = 5.0 * 1000.0 / 3600.0; // 5 km/h walking speed
                        let duration_seconds = distance / avg_speed_ms;
                        let duration_minutes = duration_seconds / 60.0;

                        total_time += duration_minutes;
                        travel_times.push(TravelTime {
                            id: id.clone(),
                            address: location.address.clone().unwrap_or_default(),
                            duration: duration_minutes.round() as u32,
                            distance,
                            estimated: true,
                            transit_summary: Some("🚶 Walking (estimated)".to_string()),
                        });

                        // Create fallback route with just start and end points
                        routes.push(Route {
                            id: id.clone(),
                            geometry: LineString::new(vec![
                                (location.longitude, location.latitude),
                                (candidate.longitude, candidate.latitude),
                            ]),
                            steps: vec![],
                        });
                    }
                }
            }

            let score = total_time;

            if score < best_score {
                best_score = score;
                best_point = candidate;
                best_travel_times = travel_times;
                best_routes = routes;
            }
        }

        let meeting_point = MeetingPoint {
            name: "Optimal Transit Meeting Point".to_string(),
            coordinates: (best_point.longitude, best_point.latitude),
            travel_times: best_travel_times,
        };

        Ok((meeting_point, best_routes))
    }


    fn get_transit_icon(vehicle_type: &str) -> &'static str {
        match vehicle_type.to_lowercase().as_str() {
            "subway" | "metro" => "🚇",
            "bus" => "🚌",
            "train" | "rail" => "🚆",
            "tram" | "light_rail" => "🚊",
            "ferry" => "⛴️",
            _ => "🚋",
        }
    }


    fn extract_route_geometry(
        steps: &[crate::models::transit::TransitStep],
        from: &Location,
        to: &Location,
    ) -> Vec<(f64, f64)> {
        let mut coordinates = Vec::new();
        
        // Start with the origin
        coordinates.push((from.longitude, from.latitude));
        
        // Extract coordinates from steps if available
        for step in steps {
            if let Some(geometry) = &step.geometry {
                coordinates.extend(geometry.coordinates.iter().map(|coord| {
                    (coord[0], coord[1])
                }));
            }
        }
        // End with the destination
        coordinates.push((to.longitude, to.latitude));
        
        // Remove duplicates while preserving order
        let mut unique_coords = Vec::new();
        let mut last_coord: Option<(f64, f64)> = None;
        
        for &coord in &coordinates {
            if last_coord.map_or(true, |last| last != coord) {
                unique_coords.push(coord);
                last_coord = Some(coord);
            }
        }
        
        unique_coords
    }

    fn find_centroid(locations: &[(String, Location)]) -> Location {
        let points: Vec<Point<f64>> = locations
            .iter()
            .map(|(_, loc)| loc.to_point())
            .collect();

        let multi_point = MultiPoint::new(points);
        let centroid_point = multi_point.centroid().unwrap();
                
        Location::new(centroid_point.y(), centroid_point.x())
    }

    fn generate_candidate_points(initial_point: &Location) -> Vec<Location> {
        //TODO: BETTER
        // In a real implementation, you would:
        // 1. Query for transit stations near the initial point
        // 2. Add popular meeting places (cafes, libraries, etc.)
        // For now, we'll just use the initial point and some nearby points
        
        let mut candidates = vec![initial_point.clone()];
        
        // Add some points around the initial point (simplified example)
        for i in 1..2 {
            let offset = 0.002 * i as f64; // About 200m per offset
            candidates.push(Location::new(
                initial_point.latitude + offset,
                initial_point.longitude,
            ));
            candidates.push(Location::new(
                initial_point.latitude - offset,
                initial_point.longitude,
            ));
            candidates.push(Location::new(
                initial_point.latitude,
                initial_point.longitude + offset,
            ));
            candidates.push(Location::new(
                initial_point.latitude,
                initial_point.longitude - offset,
            ));
        }
        
        candidates
    }
}