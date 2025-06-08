use actix_cors::Cors;
use actix_web::{middleware, App, HttpServer, web};
use dotenv::dotenv;
use log::info;
use std::env;

mod algorithms;
mod models;
mod routes;
mod services;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();
    
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));
    
    let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = env::var("PORT")
        .unwrap_or_else(|_| "3000".to_string())
        .parse::<u16>()
        .unwrap_or(3000);
        
    info!("Starting Voilà! API server on {}:{}", host, port);
    
    let _ = services::cache_service::CacheService::cache().await;
    info!("Global cache service initialized");
    
    HttpServer::new(|| {
        
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);
            
        App::new()
            .wrap(middleware::Logger::default())
            .wrap(cors)
            .configure(routes::configure)
            .route("/health", web::get().to(|| async { "OK" }))
    })
    .bind((host, port))?
    .run()
    .await
}