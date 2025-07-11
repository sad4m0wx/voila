use geo_types::Point;
use serde::{Deserialize, Serialize};
use crate::models::api::TravelTime;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
    pub latitude: f64,
    pub longitude: f64,
    pub address: Option<String>,
    pub place_id: Option<String>,
}

impl Location {
    pub fn new(latitude: f64, longitude: f64) -> Self {
        Self {
            latitude,
            longitude,
            address: None,
            place_id: None,
        }
    }

    pub fn with_address(mut self, address: impl Into<String>) -> Self {
        self.address = Some(address.into());
        self
    }

    pub fn to_point(&self) -> Point<f64> {
        Point::new(self.longitude, self.latitude)
    }

    pub fn distance_to(&self, other: &Location) -> f64 {
        // Haversine formula to calculate distance between two points on Earth
        const EARTH_RADIUS: f64 = 6371000.0; // Earth radius in meters
        
        let lat1 = self.latitude.to_radians();
        let lon1 = self.longitude.to_radians();
        let lat2 = other.latitude.to_radians();
        let lon2 = other.longitude.to_radians();
        
        let dlat = lat2 - lat1;
        let dlon = lon2 - lon1;
        
        let a = (dlat / 2.0).sin().powi(2) + lat1.cos() * lat2.cos() * (dlon / 2.0).sin().powi(2);
        let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());
        
        EARTH_RADIUS * c
    }

    pub fn is_in_ile_de_france(&self) -> bool {
        // Île-de-France approximate bounding box
        const IDF_BOUNDS: [(f64, f64); 2] = [
            (1.4462, 48.1201), // Southwest corner (lon, lat)
            (3.5590, 49.2412)  // Northeast corner (lon, lat)
        ];
        
        self.longitude >= IDF_BOUNDS[0].0 && 
        self.longitude <= IDF_BOUNDS[1].0 && 
        self.latitude >= IDF_BOUNDS[0].1 && 
        self.latitude <= IDF_BOUNDS[1].1
    }
}



#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeetingPoint {
    pub name: String,
    pub coordinates: (f64, f64), // [longitude, latitude]
    pub travel_times: Vec<TravelTime>,
}

