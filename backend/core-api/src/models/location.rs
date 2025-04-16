use geo_types::{Coord, Point};
use serde::{Deserialize, Serialize};

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

    pub fn with_place_id(mut self, place_id: impl Into<String>) -> Self {
        self.place_id = Some(place_id.into());
        self
    }

    pub fn to_point(&self) -> Point<f64> {
        Point::new(self.longitude, self.latitude)
    }
    
    pub fn to_coord(&self) -> Coord<f64> {
        Coord {
            x: self.longitude,
            y: self.latitude,
        }
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddressInput {
    pub id: String,
    pub address: Option<String>,
    pub coordinates: Option<(f64, f64)>, // [longitude, latitude]
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeetingPointRequest {
    pub addresses: Vec<AddressInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TravelTime {
    pub id: String,
    pub address: String,
    pub duration: u32, // in minutes
    pub distance: f64, // in meters
    pub estimated: bool,
    pub transit_summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeetingPoint {
    pub name: String,
    pub coordinates: (f64, f64), // [longitude, latitude]
    pub travel_times: Vec<TravelTime>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeetingPointResponse {
    pub meeting_point: MeetingPoint,
    pub routes: Vec<Route>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Route {
    pub id: String,
    pub geometry: LineString,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LineString {
    pub r#type: String, // Always "LineString"
    pub coordinates: Vec<(f64, f64)>, // Array of [longitude, latitude] points
}

impl LineString {
    pub fn new(coordinates: Vec<(f64, f64)>) -> Self {
        Self {
            r#type: "LineString".to_string(),
            coordinates,
        }
    }
}