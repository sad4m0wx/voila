use redis::{AsyncCommands, Client};
use serde::{Deserialize, Serialize};
use std::env;
use anyhow::Result;
use log::{debug, error};

pub struct RedisClient {
    client: Client,
}

impl RedisClient {
    pub fn new() -> Result<Self> {
        let redis_url = env::var("REDIS_URL")
            .unwrap_or_else(|_| "redis://localhost:6379".to_string());
        
        let client = Client::open(redis_url)?;
        Ok(Self { client })
    }
    
    pub async fn get<T: for<'de> Deserialize<'de>>(&self, key: &str) -> Option<T> {
        let mut conn = match self.client.get_multiplexed_async_connection().await {
            Ok(conn) => conn,
            Err(e) => {
                error!("Redis connection error: {}", e);
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
        let mut conn = self.client.get_multiplexed_async_connection().await?;
        let data = serde_json::to_string(value)?;
        conn.set_ex(key, data, ttl as usize).await?;
        Ok(())
    }
    
    pub async fn delete(&self, key: &str) -> Result<()> {
        let mut conn = self.client.get_multiplexed_async_connection().await?;
        conn.del(key).await?;
        Ok(())
    }
}