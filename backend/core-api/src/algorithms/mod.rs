//! Meeting Point Algorithms
//! 
//! This module provides three approaches to finding optimal meeting points:
//!
//! ## Isochrone Algorithm
//! - Uses progressive isochrone intersection analysis
//! - More accurate but slower
//! - Caches isochrones for 30 days
//! - Falls back to geometric methods if API fails
//!
//! ## Classic Algorithm  
//! - Simple geometric approach with route optimization
//! - Fast and reliable
//! - Generates candidates around centroid and evaluates them
//!
//! ## Race Manager
//! - Runs both algorithms in parallel
//! - Returns the first successful result
//! - Continues failed algorithm in background for caching
//! - Provides geometric fallback if both fail

// Fix the module names to match your actual files
pub mod isochrone_algorithm;
pub mod candidate_points_algorithm;
pub mod race_manager;

// Re-export with consistent names for the race manager
pub use race_manager::find_optimal_meeting_point;