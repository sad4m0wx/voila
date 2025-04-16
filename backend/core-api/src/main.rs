use actix_web::{web, App, HttpServer, HttpResponse, Responder};
use serde::{Deserialize, Serialize};

mod algorithms;
mod routes;
mod models;
mod utils;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new()
            .service(web::scope("/api")
                .configure(routes::meeting_point::config)
                .configure(routes::transit::config)
                .configure(routes::venues::config))
            .route("/health", web::get().to(health_check))
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}

async fn health_check() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}