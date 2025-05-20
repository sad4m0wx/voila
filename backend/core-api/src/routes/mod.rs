pub mod meeting_point;

use actix_web::web;

pub fn configure(cfg: &mut web::ServiceConfig) {
    meeting_point::configure(cfg);
}