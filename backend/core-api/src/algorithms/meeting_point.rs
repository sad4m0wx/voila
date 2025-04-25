use crate::models::location::{AddressInput, Location, MeetingPoint, TravelTime};
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
    ) -> anyhow::Result<MeetingPoint> {
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

        // 3. For each candidate, evaluate total transit time using GraphHopper
        let graphhopper = GraphHopperClient::new();
        let departure = departure_time.map(|ts| 
            chrono::DateTime::<Utc>::from_timestamp(ts, 0).unwrap()
        );

        let mut best_point = centroid.clone();
        let mut best_score = f64::MAX;
        let mut best_travel_times = Vec::new();

        for candidate in candidate_points {
            let mut total_time = 0.0;
            let mut travel_times = Vec::new();

            for (id, location) in &locations {
                match graphhopper.get_transit_route(location, &candidate, departure).await {
                    Ok((duration, distance, _steps)) => {
                        let duration_minutes = duration.as_secs() as f64 / 60.0;
                        total_time += duration_minutes;

                        travel_times.push(TravelTime {
                            id: id.clone(),
                            address: location.address.clone().unwrap_or_default(),
                            duration: duration_minutes.round() as u32,
                            distance,
                            estimated: false,
                            transit_summary: Some(format!("{:.1} minutes via transit", duration_minutes)),
                        });
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
                            transit_summary: None,
                        });
                    }
                }
            }

            // Score this candidate (lower is better)
            // We could use other factors like POI quality, transfer count, etc.
            let score = total_time;

            if score < best_score {
                best_score = score;
                best_point = candidate;
                best_travel_times = travel_times;
            }
        }

        // 4. Return the optimal meeting point
        Ok(MeetingPoint {
            name: "Optimal Transit Meeting Point".to_string(),
            coordinates: (best_point.longitude, best_point.latitude),
            travel_times: best_travel_times,
        })
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