use crate::models::{Location, Route, MeetingPointResponse};
use crate::models::isochrone::IsochroneResult;
use crate::models::transit::TransitStep;
use redis::{Client, RedisResult};
use serde::{Serialize, Deserialize};
use std::sync::Arc;
use tokio::sync::OnceCell;
use log::{info, warn, error, debug};
use anyhow::{Result, anyhow};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::time::Duration;

// Global cache instance - initialized once, reused everywhere
static CACHE_SERVICE: OnceCell<Arc<CacheService>> = OnceCell::const_new();

#[derive(Clone)]
pub struct CacheService {
    redis: Client,
}

#[derive(Serialize, Deserialize, Clone)]
struct CachedIsochrone {
    pub origin: Location,
    pub time_limit_minutes: u32,
    pub profile: String,
    pub polygon_data: Vec<u8>,
    pub created_at: i64,
}

#[derive(Serialize, Deserialize, Clone)]
struct CachedRoute {
    pub from: Location,
    pub to: Location, 
    pub profile: String,
    pub route_data: Vec<u8>,
    pub created_at: i64,
}

#[derive(Serialize, Deserialize, Clone)]
struct CachedTransitRoute {
    pub from: Location,
    pub to: Location,
    pub profile: String,
    pub route_data: Vec<u8>,
    pub created_at: i64,
}

impl CacheService {

    pub async fn global() -> Arc<CacheService> {
        CACHE_SERVICE.get_or_init(|| async {
            match Self::new().await {
                Ok(cache) => Arc::new(cache),
                Err(e) => {
                    error!("Failed to initialize cache service: {}", e);
                    Arc::new(Self::create_null_cache())
                }
            }
        }).await.clone()
    }

    async fn new() -> Result<Self> {
        let redis_url = std::env::var("REDIS_URL")
            .unwrap_or_else(|_| "redis://localhost:6379".to_string());
        
        info!("Initializing cache service with Redis at: {}", redis_url);
        let client = Client::open(redis_url)?;
        
        // Test connection
        let mut conn = client.get_multiplexed_async_connection().await?;
        let _: String = redis::cmd("PING").query_async(&mut conn).await?;
        
        info!("Cache service initialized successfully");
        Ok(Self { redis: client })
    }

    pub async fn cache() -> Arc<CacheService> {
        CacheService::global().await
    }

    pub async fn is_available(&self) -> bool {
        match self.redis.get_multiplexed_async_connection().await {
            Ok(mut conn) => {
                match redis::cmd("PING").query_async::<_, String>(&mut conn).await {
                    Ok(_) => true,
                    Err(_) => false
                }
            }
            Err(_) => false
        }
    }

    /// Create a null cache that handles all operations gracefully when Redis is unavailable
    fn create_null_cache() -> Self {
        warn!("Creating null cache - all cache operations will be no-ops");
        let client = Client::open("redis://localhost:6379").unwrap();
        Self { redis: client }
    }

    // =============================================================================
    // MEETING POINT CACHING
    // =============================================================================

    pub async fn get_cached_meeting_point_result(
        &self,
        locations: &[(String, Location)],
    ) -> Option<MeetingPointResponse> {

        if !self.is_available().await {
            return None;
        }

        let locations_hash = self.hash_locations(locations);
        let cache_key = format!("meeting_point:{}", locations_hash);
        let mut conn = self.redis.get_multiplexed_async_connection().await.ok()?;
        
        match redis::cmd("GET").arg(&cache_key).query_async::<_, Vec<u8>>(&mut conn).await {
            Ok(data) => {
                if data.is_empty() {
                    debug!("Empty data returned from cache for key: {}", cache_key);
                    return None;
                }
                
                match serde_json::from_slice(&data) {
                    Ok(result) => {
                        info!("🎯 Meeting point cache hit for key: {}", cache_key);
                        Some(result)
                    }
                    Err(e) => {
                        error!("Failed to deserialize cached meeting point for key {}: {} (data length: {})", 
                               cache_key, e, data.len());
                        // Clear corrupted cache entry
                        let _ = redis::cmd("DEL").arg(&cache_key).query_async::<_, ()>(&mut conn).await;
                        None
                    }
                }
            }
            Err(e) => {
                debug!("Cache miss for meeting point key {}: {}", cache_key, e);
                None
            }
        }
    }

    pub async fn cache_meeting_point_result(
        &self,
        locations: &[(String, Location)],
        result: &MeetingPointResponse,
        ttl: Option<u32>,
    ) -> Result<()> {
        if !self.is_available().await {
            debug!("Cache not available, skipping meeting point cache");
            return Err(anyhow!("Cache not available"));
        }

        let locations_hash = self.hash_locations(locations);
        let cache_key = format!("meeting_point:{}", locations_hash);
        let serialized = serde_json::to_vec(result)?;
        
        let mut conn = self.redis.get_multiplexed_async_connection().await?;
        let _: RedisResult<()> = redis::cmd("SETEX")
            .arg(&cache_key)
            .arg(ttl)
            .arg(serialized)
            .query_async(&mut conn).await;
        
        info!("💾 Cached meeting point result");
        Ok(())
    }

    pub fn hash_locations(&self, locations: &[(String, Location)]) -> String {
        // Sort by ID for consistent hashing
        let mut sorted_locations = locations.to_vec();
        sorted_locations.sort_by(|a, b| a.0.cmp(&b.0));

        // Create a string representing the sorted locations
        let location_str = sorted_locations.iter()
            .map(|(id, location)| {
                format!("{}:{:.4},{:.4}", id, location.latitude, location.longitude)
            })
            .collect::<Vec<_>>()
            .join(";");
        
        let hash = self.hash_string(&location_str);
        debug!("Generated location hash: {} for location_str: {}", hash, location_str);
        hash
    }

    // =============================================================================
    // ROUTE CACHING
    // =============================================================================

    /// Cache transit route result (Duration, f64, Vec<TransitStep>)
    pub async fn get_cached_route(
        &self,
        from: &Location,
        to: &Location,
        profile: &str,
    ) -> Option<(Duration, f64, Vec<TransitStep>)> {

        if !self.is_available().await {
            return None;
        }

        let cache_key = self.hash_route(from, to, profile);
        let mut conn = self.redis.get_multiplexed_async_connection().await.ok()?;
        
        match redis::cmd("GET").arg(&cache_key).query_async::<_, Vec<u8>>(&mut conn).await {
            Ok(data) => {
                if data.is_empty() {
                    debug!("Empty transit route data returned from cache for key: {}", cache_key);
                    return None;
                }
                
                match serde_json::from_slice::<CachedTransitRoute>(&data) {
                    Ok(cached) => {
                        match serde_json::from_slice(&cached.route_data) {
                            Ok((duration, distance, steps)) => {
                                info!("🛣️ Transit route cache hit for key: {}", cache_key);
                                Some((duration, distance, steps))
                            }
                            Err(e) => {
                                error!("Failed to deserialize transit route data for key {}: {} (data length: {})", 
                                       cache_key, e, cached.route_data.len());
                                // Clear corrupted cache entry
                                let _ = redis::cmd("DEL").arg(&cache_key).query_async::<_, ()>(&mut conn).await;
                                None
                            }
                        }
                    }
                    Err(e) => {
                        error!("Failed to deserialize cached transit route for key {}: {} (data length: {})", 
                               cache_key, e, data.len());
                                // Clear corrupted cache entry
                                let _ = redis::cmd("DEL").arg(&cache_key).query_async::<_, ()>(&mut conn).await;
                                None
                    }
                }
            }
            Err(e) => {
                debug!("Cache miss for transit route key {}: {}", cache_key, e);
                None
            }
        }
    }

    /// Cache transit route result (Duration, f64, Vec<TransitStep>)
    pub async fn cache_route(
        &self,
        from: &Location,
        to: &Location,
        profile: &str,
        result: &(Duration, f64, Vec<TransitStep>),
        ttl_seconds: Option<u32>,
    ) -> Result<()> {

        if !self.is_available().await {
            debug!("Cache not available, skipping transit route cache");
            return Ok(());
        }

        let cache_key = self.hash_route(from, to, profile);
        let route_data = serde_json::to_vec(result)?;
        
        let cached_route = CachedTransitRoute {
            from: from.clone(),
            to: to.clone(),
            profile: profile.to_string(),
            route_data,
            created_at: chrono::Utc::now().timestamp()
        };

        let serialized = serde_json::to_vec(&cached_route)?;
        
        let mut conn = self.redis.get_multiplexed_async_connection().await?;
        let _: RedisResult<()> = redis::cmd("SETEX")
            .arg(&cache_key)
            .arg(ttl_seconds)
            .arg(serialized)
            .query_async(&mut conn).await;
        
        info!("💾 Cached transit route for key: {}", cache_key);
        Ok(())
    }

    fn hash_route(&self, from: &Location, to: &Location, profile: &str) -> String {
        let from_hash = format!("{:.4},{:.4}", from.latitude, from.longitude);
        let to_hash = format!("{:.4},{:.4}", to.latitude, to.longitude);
        let cache_key = format!("route:{}:{}:{}:{}", profile, from_hash, to_hash, 
                self.hash_string(&format!("{}{}{}", profile, from_hash, to_hash)));
        debug!("Generated route cache key: {} (from: {}, to: {}, profile: {})", 
               cache_key, from_hash, to_hash, profile);
        cache_key
    }

    // =============================================================================
    // ISOCHRONE CACHING
    // =============================================================================


    pub async fn get_cached_isochrone(
        &self,
        origin: &Location,
        time_limit: u32,
        profile: &str,
    ) -> Option<IsochroneResult> {

        if !self.is_available().await {
            return None;
        }

        let isochrone_cache_key = self.hash_isochrone(origin, time_limit, profile);
        let mut conn = self.redis.get_multiplexed_async_connection().await.ok()?;
        
        match redis::cmd("GET").arg(&isochrone_cache_key).query_async::<_, Vec<u8>>(&mut conn).await {
            Ok(data) => {
                match serde_json::from_slice::<CachedIsochrone>(&data) {
                    Ok(cached) => {
                        match serde_json::from_slice(&cached.polygon_data) {
                            Ok(polygon) => {
                                let result = IsochroneResult {
                                    id: isochrone_cache_key,
                                    location: cached.origin,
                                    time_limit_minutes: cached.time_limit_minutes,
                                    profile: cached.profile,
                                    polygon,
                                    created_at: chrono::DateTime::from_timestamp(cached.created_at, 0)
                                        .unwrap_or_else(chrono::Utc::now),
                                    bucket: 0,
                                };
                                info!("🌐 Isochrone cache hit");
                                Some(result)
                            }
                            Err(e) => {
                                error!("Failed to deserialize polygon data: {}", e);
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

    pub async fn get_cached_isochrones(
        &self,
        origins: &[(String, Location)],
        time_limit: u32,
        profile: &str,
    ) -> Vec<Option<IsochroneResult>> {
        
        if !self.is_available().await {
            return vec![None; origins.len()];
        }

        let mut futures = Vec::with_capacity(origins.len());
        
        for (_, origin) in origins {
            futures.push(async move {
                self.get_cached_isochrone(origin, time_limit, profile).await
            });
        }
        
        let all_results = futures::future::join_all(futures).await;
        let cache_hits = all_results.iter().filter(|r| r.is_some()).count();
        info!("🌐 Isochrone cache: {}/{} hits", cache_hits, origins.len());
        
        all_results
    }
    
    pub async fn cache_isochrone(
        &self,
        origin: &Location,
        time_limit_minutes: u32,
        profile: &str,
        isochrone: &IsochroneResult,
        ttl: Option<u32>,
    ) -> Result<()> {
        if !self.is_available().await {
            debug!("Cache not available, skipping isochrone cache");
            return Ok(());
        }

        let cache_key = self.hash_isochrone(origin, time_limit_minutes, profile);
        let polygon_data = serde_json::to_vec(&isochrone.polygon)?;
        
        let cached_isochrone = CachedIsochrone {
            origin: origin.clone(),
            time_limit_minutes: time_limit_minutes,
            profile: profile.to_string(),
            polygon_data,
            created_at: chrono::Utc::now().timestamp(),
        };

        let serialized = serde_json::to_vec(&cached_isochrone)?;
        
        let mut conn = self.redis.get_multiplexed_async_connection().await?;
        let _: RedisResult<()> = redis::cmd("SETEX")
            .arg(&cache_key)
            .arg(ttl)
            .arg(serialized)
            .query_async(&mut conn).await;
        
        info!("💾 Cached isochrone");
        Ok(())
    }

    fn hash_isochrone(&self, location: &Location, time_limit: u32, profile: &str) -> String {
        let location_hash = format!("{:.4},{:.4}", location.latitude, location.longitude);
        format!("isochrone:{}:{}:{}:{}", 
                profile, time_limit, location_hash,
                self.hash_string(&format!("{}{}{}", profile, time_limit, location_hash)))
    }

    // =============================================================================
    // UTILITY
    // =============================================================================

    fn hash_string(&self, input: &str) -> String {
        let mut hasher = DefaultHasher::new();
        input.hash(&mut hasher);
        format!("{:x}", hasher.finish())
    }

    pub async fn clear_all(&self) -> Result<()> {
        if !self.is_available().await {
            return Ok(());
        }

        let mut conn = self.redis.get_multiplexed_async_connection().await?;
        let _: RedisResult<()> = redis::cmd("FLUSHDB").query_async(&mut conn).await;
        info!("Cleared all cache data");
        Ok(())
    }

    /// Get cache statistics for debugging
    pub async fn get_cache_stats(&self) -> Result<String> {
        if !self.is_available().await {
            return Ok("Cache not available".to_string());
        }

        let mut conn = self.redis.get_multiplexed_async_connection().await?;
        
        let info: String = redis::cmd("INFO").arg("memory").query_async(&mut conn).await?;
        let keys_count: i32 = redis::cmd("DBSIZE").query_async(&mut conn).await.unwrap_or(0);
        
        // Get counts for different key types
        let meeting_point_keys: Vec<String> = redis::cmd("KEYS").arg("meeting_point:*").query_async(&mut conn).await.unwrap_or_default();
        let route_keys: Vec<String> = redis::cmd("KEYS").arg("route:*").query_async(&mut conn).await.unwrap_or_default();
        let isochrone_keys: Vec<String> = redis::cmd("KEYS").arg("isochrone:*").query_async(&mut conn).await.unwrap_or_default();
        
        Ok(format!(
            "Cache Stats:\n\
             - Total keys: {}\n\
             - Meeting point cache entries: {}\n\
             - Route cache entries: {}\n\
             - Isochrone cache entries: {}\n\
             - Memory info: {}",
            keys_count,
            meeting_point_keys.len(),
            route_keys.len(),
            isochrone_keys.len(),
            info.lines().take(3).collect::<Vec<_>>().join(", ")
        ))
    }
}
