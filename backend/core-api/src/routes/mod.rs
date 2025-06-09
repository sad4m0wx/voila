pub mod meeting_point;
pub mod preload;

use actix_web::web;

pub fn configure(cfg: &mut web::ServiceConfig) {
    meeting_point::configure(cfg);
    preload::configure(cfg);
}