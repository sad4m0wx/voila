use redis::{AsyncCommands, Client};
use serde::{Deserialize, Serialize};
use std::env;
use anyhow::Result;
use log::{debug, warn, info};

pub struct RedisClient {
    client: Option<Client>,
}

impl RedisClient {
    pub fn new() -> Result<Self> {
        let redis_url = env::var("REDIS_URL")
            .unwrap_or_else(|_| "redis://localhost:6379".to_string());
        
        info!("Attempting to connect to Redis at: {}", redis_url);
        
        match Client::open(redis_url.clone()) {
            Ok(client) => {
                info!("Redis client created successfully");
                Ok(Self { client: Some(client) })
            }
            Err(e) => {
                warn!("Redis client creation failed: {}, continuing without caching", e);
                Ok(Self { client: None })
            }
        }
    }
    
    pub async fn get<T: for<'de> Deserialize<'de>>(&self, key: &str) -> Option<T> {
        let client = match &self.client {
            Some(client) => client,
            None => {
                debug!("Redis not available, skipping cache get for key: {}", key);
                return None;
            }
        };
        
        let mut conn = match client.get_multiplexed_async_connection().await {
            Ok(conn) => conn,
            Err(e) => {
                debug!("Redis connection error: {}", e);
                return None;
            }
        };
        
        let data: Option<String> = match conn.get(key).await {
            Ok(data) => data,
            Err(e) => {
                debug!("Redis get error for key {}: {}", key, e);
                return None;
            }
        };
        
        data.and_then(|s| serde_json::from_str(&s).ok())
    }
    
    pub async fn set<T: Serialize>(&self, key: &str, value: &T, ttl: u64) -> Result<()> {
        let client = match &self.client {
            Some(client) => client,
            None => {
                debug!("Redis not available, skipping cache set for key: {}", key);
                return Ok(()); // Return success when Redis is not available
            }
        };
        
        match client.get_multiplexed_async_connection().await {
            Ok(mut conn) => {
                let data = serde_json::to_string(value)?;
                match conn.set_ex::<_, _, ()>(key, data, ttl as usize).await {
                    Ok(_) => Ok(()),
                    Err(e) => {
                        warn!("Failed to set Redis key {}: {}", key, e);
                        Ok(()) // Don't fail the operation if Redis is unavailable
                    }
                }
            }
            Err(e) => {
                warn!("Redis connection error during set: {}", e);
                Ok(()) // Don't fail the operation if Redis is unavailable
            }
        }
    }
    
    pub async fn delete(&self, key: &str) -> Result<()> {
        let client = match &self.client {
            Some(client) => client,
            None => {
                debug!("Redis not available, skipping cache delete for key: {}", key);
                return Ok(());
            }
        };
        
        match client.get_multiplexed_async_connection().await {
            Ok(mut conn) => {
                match conn.del::<_, ()>(key).await {
                    Ok(_) => Ok(()),
                    Err(e) => {
                        warn!("Failed to delete Redis key {}: {}", key, e);
                        Ok(())
                    }
                }
            }
            Err(e) => {
                warn!("Redis connection error during delete: {}", e);
                Ok(())
            }
        }
    }
}