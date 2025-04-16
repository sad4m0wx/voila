use crate::models::location::{AddressInput, Location, MeetingPoint, TravelTime};
use geo::algorithm::centroid::Centroid;
use geo_types::{MultiPoint, Point};
use log::{debug, info};

pub struct MeetingPointFinder;

impl MeetingPointFinder {
    /// Finds the optimal meeting point based on input addresses
    pub fn find_optimal_meeting_point(addresses: &[AddressInput]) -> anyhow::Result<MeetingPoint> {
        // Validate input
        if addresses.len() < 2 {
            return Err(anyhow::anyhow!("At least two addresses are required"));
        }

        // Convert addresses to locations
        let mut locations = Vec::new();
        for address in addresses {
            if let Some(coords) = address.coordinates {
                locations.push((
                    address.id.clone(),
                    Location::new(coords.1, coords.0)
                        .with_address(address.address.clone().unwrap_or_default()),
                ));
            } else {
                return Err(anyhow::anyhow!(
                    "Missing coordinates for address: {}",
                    address.id
                ));
            }
        }

        // Start with a simple geometric center (centroid)
        let centroid = Self::find_centroid(&locations);
        debug!("Calculated centroid: {:?}", centroid);

        // Calculate estimated travel times
        let travel_times = Self::calculate_travel_times(&locations, &centroid);

        // Create the meeting point result
        let meeting_point = MeetingPoint {
            name: "Optimal Meeting Point".to_string(),
            coordinates: (centroid.longitude, centroid.latitude),
            travel_times,
        };

        Ok(meeting_point)
    }

    /// Calculates the geometric center (centroid) of multiple locations
    fn find_centroid(locations: &[(String, Location)]) -> Location {
        let points: Vec<Point<f64>> = locations
            .iter()
            .map(|(_, loc)| loc.to_point())
            .collect();

        let multi_point = MultiPoint::new(points);
        
        // Calculate the centroid of all points
        let centroid_point = multi_point.centroid()
        .ok_or_else(|| anyhow::anyhow!("Failed to calculate centroid: no points provided"))
        .unwrap();
                
        // Convert back to our Location type
        Location::new(
            centroid_point.y(), 
            centroid_point.x()
        )
    }

    /// Estimates travel times from each location to the meeting point
    fn calculate_travel_times(
        locations: &[(String, Location)],
        meeting_point: &Location,
    ) -> Vec<TravelTime> {
        locations
            .iter()
            .map(|(id, location)| {
                let distance = location.distance_to(meeting_point);
                
                // Estimate travel time based on distance
                // Assumes average speed of 20 km/h for urban travel
                let average_speed_ms = 20.0 * 1000.0 / 3600.0; // 20 km/h in m/s
                let duration_seconds = distance / average_speed_ms;
                let duration_minutes = (duration_seconds / 60.0).round() as u32;

                TravelTime {
                    id: id.clone(),
                    address: location.address.clone().unwrap_or_default(),
                    duration: duration_minutes,
                    distance,
                    estimated: true,
                    transit_summary: None,
                }
            })
            .collect()
    }
}