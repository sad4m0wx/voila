use serde::{Deserialize, Serialize};
use crate::models::geometry::Route;
use crate::models::debug::DebugData;
use crate::models::location::MeetingPoint;

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
pub struct MeetingPointResponse {
    pub meeting_point: MeetingPoint,
    pub routes: Vec<Route>,
    pub venues: Option<Vec<Venue>>, // Optional list of nearby venues
    pub debug_data: Option<DebugData>, // Optional debugging information
}

// Note: Venue struct is defined here but unused in backend - consider removing if not needed
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Venue {
    pub id: String,
    pub name: String,
    pub location: (f64, f64),
    pub photo_reference: Option<String>,
    pub google_maps_links: Option<Vec<String>>,
    pub types: String,
} 