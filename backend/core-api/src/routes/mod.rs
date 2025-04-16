pub mod meeting_point;
pub mod itinerary;
pub mod venues;

use actix_web::web;

pub fn configure(cfg: &mut web::ServiceConfig) {
    meeting_point::configure(cfg);
    itinerary::configure(cfg);
    venues::configure(cfg);
}