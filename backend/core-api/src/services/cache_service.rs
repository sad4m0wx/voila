use crate::models::location::Location;
use crate::models::isochrone::IsochroneResult;
use crate::models::location::Route;
use redis::{Client, RedisResult};
use serde::{Serialize, Deserialize};
use std::sync::Arc;
use tokio::sync::OnceCell;
use log::{info, warn, error, debug};
use uuid::Uuid;
use anyhow::{Result, anyhow};

// Global cache instance - initialized once, reused everywhere
static CACHE_SERVICE: OnceCell<Arc<CacheService>> = OnceCell::const_new();

#[derive(Clone)]
pub struct CacheService {
    redis: Client,
    connection_pool: Option<Arc<redis::aio::MultiplexedConnection>>,
}

#[derive(Serialize, Deserialize, Clone)]
struct CachedIsochrone {
    pub location: Location,
    pub time_limit_seconds: u32,
    pub profile: String,
    pub polygon_data: Vec<u8>, // Compressed polygon data
    pub created_at: i64,
}

#[derive(Serialize, Deserialize, Clone)]
struct CachedRoute {
    pub from: Location,
    pub to: Location, 
    pub profile: String,
    pub route_data: Vec<u8>, // Compressed route data
    pub created_at: i64,
}

impl CacheService {
    /// Get the global cache service instance (always ready, no warmup delay)
    pub async fn global() -> Arc<CacheService> {
        CACHE_SERVICE.get_or_init(|| async {
            match Self::new().await {
                Ok(cache) => Arc::new(cache),
                Err(e) => {
                    error!("Failed to initialize cache service: {}", e);
                    // Return a "null" cache that gracefully handles failures
                    Arc::new(Self::create_null_cache())
                }
            }
        }).await.clone()
    }

    /// Create new cache service with connection pool
    async fn new() -> Result<Self> {
        let redis_url = std::env::var("REDIS_URL")
            .unwrap_or_else(|_| "redis://localhost:6379".to_string());
        
        info!("Initializing cache service with Redis at: {}", redis_url);
        
        let client = Client::open(redis_url)?;
        
        // Create persistent multiplexed connection
        let connection_pool = Arc::new(
            client.get_multiplexed_async_connection()
                .await
                .map_err(|e| anyhow!("Failed to create Redis connection pool: {}", e))?
        );
        
        info!("Cache service initialized successfully");
        
        Ok(Self {
            redis: client,
            connection_pool: Some(connection_pool),
        })
    }

    /// Create a null cache that handles all operations gracefully when Redis is unavailable
    fn create_null_cache() -> Self {
        warn!("Creating null cache - all cache operations will be no-ops");
        // Create a dummy client that won't be used
        let client = Client::open("redis://localhost:6379").unwrap();
        
        Self { 
            redis: client, 
            connection_pool: None  // Simply use None instead of unsafe code
        }
    }

    /// Check if cache is available
    async fn is_available(&self) -> bool {
        match self.redis.get_multiplexed_async_connection().await {
            Ok(mut conn) => {
                match redis::cmd("PING").query_async::<_, String>(&mut conn).await {
                    Ok(_) => true,
                    Err(_) => {
                        debug!("Redis not available");
                        false
                    }
                }
            }
            Err(_) => {
                debug!("Redis connection not available");
                false
            }
        }
    }

    // =============================================================================
    // ISOCHRONE CACHING
    // =============================================================================

    /// Get cached isochrone near the given location
    pub async fn get_nearby_isochrone(
        &self,
        location: &Location,
        time_limit: u32,
        profile: &str,
        radius_meters: f64,
    ) -> Option<IsochroneResult> {
        if !self.is_available().await {
            return None;
        }

        let geo_key = format!("isochrones:{}:{}", profile, time_limit);
        
        match self.find_nearby_isochrones(&geo_key, location, radius_meters).await {
            Ok(nearby_ids) => {
                if let Some(isochrone_id) = nearby_ids.first() {
                    return self.get_isochrone_data(isochrone_id).await;
                }
            }
            Err(e) => {
                debug!("Failed to find nearby isochrones: {}", e);
            }
        }
        
        None
    }

    /// Cache an isochrone result
    pub async fn cache_isochrone(
        &self,
        location: &Location,
        time_limit: u32,
        profile: &str,
        isochrone: &IsochroneResult,
        ttl_days: u32,
    ) -> Result<()> {
        if !self.is_available().await {
            debug!("Cache not available, skipping isochrone cache");
            return Ok(());
        }

        let isochrone_id = Uuid::new_v4().to_string();
        let geo_key = format!("isochrones:{}:{}", profile, time_limit);
        let data_key = format!("isochrone_data:{}", isochrone_id);
        
        // Compress and serialize the polygon data
        let polygon_data = Self::compress_polygon(&isochrone.polygon)?;
        
        let cached_isochrone = CachedIsochrone {
            location: location.clone(),
            time_limit_seconds: time_limit,
            profile: profile.to_string(),
            polygon_data,
            created_at: chrono::Utc::now().timestamp(),
        };

        let mut conn = self.redis.get_multiplexed_async_connection().await?;
        
        // Add to geospatial index
        let _: RedisResult<i32> = redis::cmd("GEOADD")
            .arg(&geo_key)
            .arg(location.longitude)
            .arg(location.latitude)
            .arg(&isochrone_id)
            .query_async(&mut conn).await;
        
        // Store the actual data
        let serialized = serde_json::to_vec(&cached_isochrone)?;
        let _: RedisResult<()> = redis::cmd("SETEX")
            .arg(&data_key)
            .arg(ttl_days * 24 * 3600)
            .arg(serialized)
            .query_async(&mut conn).await;
        
        info!("Cached isochrone for location ({}, {}) with {} day TTL", 
              location.latitude, location.longitude, ttl_days);
        
        Ok(())
    }

    async fn find_nearby_isochrones(
        &self,
        geo_key: &str,
        location: &Location,
        radius_meters: f64,
    ) -> Result<Vec<String>> {
        let mut conn = self.redis.get_multiplexed_async_connection().await?;
        let results: Vec<String> = redis::cmd("GEORADIUS")
            .arg(geo_key)
            .arg(location.longitude)
            .arg(location.latitude)
            .arg(radius_meters)
            .arg("m")
            .query_async(&mut conn).await?;
        
        Ok(results)
    }

    async fn get_isochrone_data(&self, isochrone_id: &str) -> Option<IsochroneResult> {
        let data_key = format!("isochrone_data:{}", isochrone_id);
        let mut conn = match self.redis.get_multiplexed_async_connection().await {
            Ok(conn) => conn,
            Err(_) => return None,
        };
        
        match redis::cmd("GET").arg(&data_key).query_async::<_, Vec<u8>>(&mut conn).await {
            Ok(data) => {
                match serde_json::from_slice::<CachedIsochrone>(&data) {
                    Ok(cached) => {
                        match Self::decompress_polygon(&cached.polygon_data) {
                            Ok(polygon) => {
                                Some(IsochroneResult {
                                    id: isochrone_id.to_string(),
                                    location: cached.location,
                                    time_limit_seconds: cached.time_limit_seconds,
                                    profile: cached.profile,
                                    polygon,
                                    created_at: chrono::DateTime::from_timestamp(cached.created_at, 0)
                                        .unwrap_or_else(chrono::Utc::now),
                                    bucket: 0,
                                })
                            }
                            Err(e) => {
                                error!("Failed to decompress polygon: {}", e);
                                None
                            }
                        }
                    }
                    Err(e) => {
                        error!("Failed to deserialize cached isochrone: {}", e);
                        None
                    }
                }
            }
            Err(_) => None,
        }
    }

    // =============================================================================
    // ROUTE CACHING
    // =============================================================================

    /// Get cached route near the given origin and destination
    pub async fn get_nearby_route(
        &self,
        from: &Location,
        to: &Location,
        profile: &str,
        radius_meters: f64,
    ) -> Option<Route> {
        if !self.is_available().await {
            return None;
        }

        let origins_key = format!("route_origins:{}", profile);
        let destinations_key = format!("route_destinations:{}", profile);
        
        // Find routes with nearby origins
        let nearby_origin_routes = self.find_nearby_routes(&origins_key, from, radius_meters).await.ok()?;
        
        // Find routes with nearby destinations  
        let nearby_dest_routes = self.find_nearby_routes(&destinations_key, to, radius_meters).await.ok()?;
        
        // Find intersection (routes that match both origin and destination)
        let matching_routes: Vec<String> = nearby_origin_routes
            .into_iter()
            .filter(|route_id| nearby_dest_routes.contains(route_id))
            .collect();
            
        if let Some(route_id) = matching_routes.first() {
            return self.get_route_data(route_id).await;
        }
        
        None
    }

    /// Cache a route result
    pub async fn cache_route(
        &self,
        from: &Location,
        to: &Location,
        profile: &str,
        route: &Route,
        ttl_seconds: u32,
    ) -> Result<()> {
        if !self.is_available().await {
            debug!("Cache not available, skipping route cache");
            return Ok(());
        }

        let route_id = Uuid::new_v4().to_string();
        let origins_key = format!("route_origins:{}", profile);
        let destinations_key = format!("route_destinations:{}", profile);
        let data_key = format!("route_data:{}", route_id);
        
        // Compress and serialize the route data
        let route_data = Self::compress_route(route)?;
        
        let cached_route = CachedRoute {
            from: from.clone(),
            to: to.clone(),
            profile: profile.to_string(),
            route_data,
            created_at: chrono::Utc::now().timestamp(),
        };

        let mut conn = self.redis.get_multiplexed_async_connection().await?;
        
        // Add to both geospatial indexes
        let _: RedisResult<i32> = redis::cmd("GEOADD")
            .arg(&origins_key)
            .arg(from.longitude)
            .arg(from.latitude)
            .arg(&route_id)
            .query_async(&mut conn).await;
        
        let _: RedisResult<i32> = redis::cmd("GEOADD")
            .arg(&destinations_key)
            .arg(to.longitude)
            .arg(to.latitude)
            .arg(&route_id)
            .query_async(&mut conn).await;
        
        // Store the actual route data
        let serialized = serde_json::to_vec(&cached_route)?;
        let _: RedisResult<()> = redis::cmd("SETEX")
            .arg(&data_key)
            .arg(ttl_seconds as usize)
            .arg(serialized)
            .query_async(&mut conn).await;
        
        info!("Cached route from ({}, {}) to ({}, {}) with {} second TTL",
              from.latitude, from.longitude, to.latitude, to.longitude, ttl_seconds);
        
        Ok(())
    }

    async fn find_nearby_routes(
        &self,
        geo_key: &str,
        location: &Location,
        radius_meters: f64,
    ) -> Result<Vec<String>> {
        let mut conn = self.redis.get_multiplexed_async_connection().await?;
        let results: Vec<String> = redis::cmd("GEORADIUS")
            .arg(geo_key)
            .arg(location.longitude)
            .arg(location.latitude)
            .arg(radius_meters)
            .arg("m")
            .query_async(&mut conn).await?;
        
        Ok(results)
    }

    async fn get_route_data(&self, route_id: &str) -> Option<Route> {
        let data_key = format!("route_data:{}", route_id);
        let mut conn = match self.redis.get_multiplexed_async_connection().await {
            Ok(conn) => conn,
            Err(_) => return None,
        };
        
        match redis::cmd("GET").arg(&data_key).query_async::<_, Vec<u8>>(&mut conn).await {
            Ok(data) => {
                match serde_json::from_slice::<CachedRoute>(&data) {
                    Ok(cached) => {
                        match Self::decompress_route(&cached.route_data) {
                            Ok(route) => Some(route),
                            Err(e) => {
                                error!("Failed to decompress route: {}", e);
                                None
                            }
                        }
                    }
                    Err(e) => {
                        error!("Failed to deserialize cached route: {}", e);
                        None
                    }
                }
            }
            Err(_) => None,
        }
    }

    // =============================================================================
    // COMPRESSION HELPERS
    // =============================================================================

    fn compress_polygon(polygon: &geo::Polygon<f64>) -> Result<Vec<u8>> {
        let serialized = serde_json::to_vec(polygon)?;
        // TODO: Add actual compression (zstd, lz4, etc) if needed
        Ok(serialized)
    }

    fn decompress_polygon(data: &[u8]) -> Result<geo::Polygon<f64>> {
        // TODO: Add actual decompression if compression was used
        let polygon = serde_json::from_slice(data)?;
        Ok(polygon)
    }

    fn compress_route(route: &Route) -> Result<Vec<u8>> {
        let serialized = serde_json::to_vec(route)?;
        // TODO: Add actual compression if needed
        Ok(serialized)
    }

    fn decompress_route(data: &[u8]) -> Result<Route> {
        // TODO: Add actual decompression if compression was used
        let route = serde_json::from_slice(data)?;
        Ok(route)
    }

    // =============================================================================
    // UTILITY METHODS
    // =============================================================================

    /// Clear all cache data (useful for testing)
    pub async fn clear_all(&self) -> Result<()> {
        if !self.is_available().await {
            return Ok(());
        }

        let mut conn = self.redis.get_multiplexed_async_connection().await?;
        let _: RedisResult<()> = redis::cmd("FLUSHDB").query_async(&mut conn).await;
        info!("Cleared all cache data");
        Ok(())
    }

    /// Get cache statistics
    pub async fn get_stats(&self) -> Result<CacheStats> {
        if !self.is_available().await {
            return Ok(CacheStats::default());
        }

        let mut conn = self.redis.get_multiplexed_async_connection().await?;
        let info: String = redis::cmd("INFO").arg("memory").query_async(&mut conn).await?;
        
        // Parse basic stats from Redis INFO
        let used_memory = Self::parse_redis_info(&info, "used_memory")?;
        let keyspace_hits = Self::parse_redis_info(&info, "keyspace_hits")?;
        let keyspace_misses = Self::parse_redis_info(&info, "keyspace_misses")?;
        
        Ok(CacheStats {
            used_memory_bytes: used_memory,
            keyspace_hits,
            keyspace_misses,
            hit_rate: if keyspace_hits + keyspace_misses > 0 {
                keyspace_hits as f64 / (keyspace_hits + keyspace_misses) as f64
            } else {
                0.0
            },
        })
    }

    fn parse_redis_info(info: &str, key: &str) -> Result<u64> {
        for line in info.lines() {
            if line.starts_with(key) {
                if let Some(value_str) = line.split(':').nth(1) {
                    return Ok(value_str.parse()?);
                }
            }
        }
        Ok(0)
    }
}

#[derive(Debug, Default)]
pub struct CacheStats {
    pub used_memory_bytes: u64,
    pub keyspace_hits: u64,
    pub keyspace_misses: u64,
    pub hit_rate: f64,
}

// =============================================================================
// CONVENIENCE FUNCTIONS FOR OTHER MODULES
// =============================================================================

/// Get the global cache service (always available)
pub async fn cache() -> Arc<CacheService> {
    CacheService::global().await
}