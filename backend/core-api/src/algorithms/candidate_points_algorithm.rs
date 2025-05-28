use crate::models::location::{AddressInput, Location, MeetingPoint, TravelTime, LineString, Route};
use crate::services::graphhopper_client::GraphHopperClient;
use crate::services::cache_service::cache;
use geo::algorithm::centroid::Centroid;
use geo_types::{MultiPoint, Point};
use log::{info, warn};
use std::sync::Arc;
use futures::future::join_all;
use std::time::Duration;
use tokio::time::timeout;

pub struct CandidatePointsAlgorithm;

#[derive(Debug, Clone)]
struct CandidateScore {
    location: Location,
    routes: Vec<Route>,
    total_time: f64,
    max_time: f64,
    estimated_count: usize,
    score: f64,
}

#[derive(Debug, Clone)]
struct CandidateGenerationConfig {
    max_candidates: usize,
    refinement_levels: usize,
}

impl Default for CandidateGenerationConfig {
    fn default() -> Self {
        Self {
            max_candidates: 25, // 1 center + 8*3 levels = max 25 candidates
            refinement_levels: 3,
        }
    }
}

const ROUTE_CACHE_TTL: u32 = 3600 * 24 * 30; // 30 days

impl CandidatePointsAlgorithm {
    /// Find meeting point using enhanced multi-scale grid candidate points algorithm
    pub async fn find_meeting_point(
        addresses: &[AddressInput],
    ) -> anyhow::Result<(MeetingPoint, Vec<Route>)> {
        info!("Starting multi-scale grid candidate points algorithm for {} addresses", addresses.len());

        // Validate input
        if addresses.len() < 2 {
            return Err(anyhow::anyhow!("At least two addresses are required"));
        }

        // Convert addresses to locations
        let locations: Vec<(String, Location)> = addresses
            .iter()
            .filter_map(|addr| {
                addr.coordinates.map(|coords| {
                    (
                        format!("addr_{}", addr.id),
                        Location::new(coords.1, coords.0)
                            .with_address(addr.address.clone().unwrap_or_default()),
                    )
                })
            })
            .collect();

        if locations.len() < 2 {
            return Err(anyhow::anyhow!("At least two valid locations are required"));
        }

        // Generate candidates using multi-scale grid search
        let candidates = Self::generate_multiscale_grid_candidates(&locations);
        info!("Generated {} multi-scale grid candidates", candidates.len());

        // Evaluate all candidates in parallel
        let scored_candidates = Self::evaluate_candidates(&locations, &candidates).await?;
        
        // Select the best candidate
        let (meeting_point, routes) = Self::select_best_candidate(&locations, scored_candidates)?;

        info!("Multi-scale grid candidate points algorithm completed successfully");
        Ok((meeting_point, routes))
    }

    /// Generate candidates using adaptive multi-scale grid search
    fn generate_multiscale_grid_candidates(
        locations: &[(String, Location)],
    ) -> Vec<Location> {
        let config = CandidateGenerationConfig::default();
        let centroid = Self::geometric_centroid(locations);
        let mut candidates = vec![centroid.clone()];

        // Calculate the maximum distance from centroid to any input location
        let max_distance_m = locations.iter()
            .map(|(_, loc)| centroid.distance_to(loc))
            .fold(0.0, f64::max);
        
        // Convert to a reasonable grid size (minimum 500m)
        let base_grid_size_m = max_distance_m.max(500.0);
        
        info!("Using base grid size of {:.0}m based on max distance {:.0}m from centroid", 
              base_grid_size_m, max_distance_m);
        
        // Generate candidates at multiple scales with square grids
        for level in 0..config.refinement_levels {
            let grid_size_m = base_grid_size_m * (0.6_f64).powi(level as i32); // 60% reduction each level
            let grid_candidates = Self::generate_square_grid(&centroid, grid_size_m);
            candidates.extend(grid_candidates.clone());
            
            info!("Level {}: grid size {:.0}m, {} candidates", level, grid_size_m, grid_candidates.len());
        }

        // Remove duplicates and limit total candidates
        candidates = Self::deduplicate_candidates(candidates, 300.0); // 300m minimum distance
        candidates.truncate(config.max_candidates);

        info!("Final candidate set: {} candidates after deduplication", candidates.len());
        candidates
    }

    /// Generate candidates in a simple square grid pattern
    fn generate_square_grid(center: &Location, grid_size_m: f64) -> Vec<Location> {
        let mut candidates = Vec::new();
        
        // Convert meters to approximate degrees (rough conversion)
        let grid_size_deg = grid_size_m / 111000.0; // 111km per degree
        
        // Create a 3x3 grid around the center (excluding center which is already added)
        let offsets = [
            (-grid_size_deg, -grid_size_deg), // SW
            (-grid_size_deg, 0.0),            // W
            (-grid_size_deg, grid_size_deg),  // NW
            (0.0, -grid_size_deg),            // S
            (0.0, grid_size_deg),             // N
            (grid_size_deg, -grid_size_deg),  // SE
            (grid_size_deg, 0.0),             // E
            (grid_size_deg, grid_size_deg),   // NE
        ];

        for (lat_offset, lng_offset) in offsets.iter() {
            let candidate = Location::new(
                center.latitude + lat_offset,
                center.longitude + lng_offset,
            );
            candidates.push(candidate);
        }

        candidates
    }

    /// Remove duplicate candidates that are too close to each other
    fn deduplicate_candidates(mut candidates: Vec<Location>, min_distance_m: f64) -> Vec<Location> {
        let mut deduplicated = Vec::new();

        for candidate in candidates.drain(..) {
            let is_duplicate = deduplicated.iter().any(|existing: &Location| {
                existing.distance_to(&candidate) < min_distance_m
            });

            if !is_duplicate {
                deduplicated.push(candidate);
            }
        }

        deduplicated
    }

    /// Evaluate all candidates by computing routes and scoring them
    async fn evaluate_candidates(
        origins: &[(String, Location)],
        candidates: &[Location],
    ) -> anyhow::Result<Vec<CandidateScore>> {
        let graphhopper = Arc::new(GraphHopperClient::new());
        let cache_service = cache().await;

        // Evaluate each candidate in parallel
        let candidate_futures: Vec<_> = candidates.iter().enumerate().map(|(i, candidate)| {
            let origins = origins.to_vec();
            let graphhopper = Arc::clone(&graphhopper);
            let cache_service = cache_service.clone();
            let candidate = candidate.clone();
            
            async move {
                info!("Evaluating candidate {}", i);
                
                // Compute routes from all origins to this candidate
                let route_futures: Vec<_> = origins.clone().into_iter().map(|(id, origin)| {
                    let candidate = candidate.clone();
                    let graphhopper = Arc::clone(&graphhopper);
                    let cache_service = cache_service.clone();
                    
                    async move {
                        // Check cache first (200m radius)
                        if let Some(cached_route) = cache_service.get_nearby_route(
                            &origin,
                            &candidate,
                            "pt", // Default to public transport
                            200.0
                        ).await {
                            info!("Cache hit for route from {} to candidate {}", id, i);
                            return (id, cached_route, false); // not estimated
                        }

                        // Compute route with timeout
                        let route_result = timeout(
                            Duration::from_secs(60),
                            graphhopper.get_transit_route(&origin, &candidate)
                        ).await;

                        match route_result {
                            Ok(Ok((_duration, _distance, steps))) => {
                                let route = Route {
                                    id: id.clone(),
                                    geometry: LineString::new(Self::extract_simple_geometry(&steps, &origin, &candidate)),
                                    steps,
                                };
                                
                                let _ = cache_service.cache_route(
                                    &origin,
                                    &candidate,
                                    "pt",
                                    &route,
                                    ROUTE_CACHE_TTL
                                ).await;
                                
                                (id, route, false) // not estimated
                            }
                            _ => {
                                // Use geometric fallback
                                let _distance = origin.distance_to(&candidate);
                                let route = Route {
                                    id: id.clone(),
                                    geometry: LineString::new(vec![
                                        (origin.longitude, origin.latitude),
                                        (candidate.longitude, candidate.latitude),
                                    ]),
                                    steps: vec![],
                                };
                                
                                (id, route, true) // estimated
                            }
                        }
                    }
                }).collect();

                let route_results = join_all(route_futures).await;
                
                // Calculate score for this candidate
                let mut total_time = 0.0;
                let mut max_time: f64 = 0.0;
                let mut estimated_count = 0;
                let mut routes = Vec::new();

                for (id, route, is_estimated) in route_results {
                    let duration_minutes = if !route.steps.is_empty() {
                        route.steps.iter().map(|step| step.duration).sum::<u32>() as f64 / 60.0
                    } else {
                        // Estimate based on distance
                        let origin = origins.iter().find(|(origin_id, _)| origin_id == &id).unwrap().1.clone();
                        let distance = origin.distance_to(&candidate);
                        distance / (20.0 * 1000.0 / 60.0) // 20 km/h average for PT
                    };

                    total_time += duration_minutes;
                    max_time = max_time.max(duration_minutes as f64);
                    
                    if is_estimated {
                        estimated_count += 1;
                    }
                    
                    routes.push(route);
                }

                // Score calculation: minimize average time + penalty for estimates + penalty for max time
                let avg_time = total_time / routes.len() as f64;
                let estimation_penalty = estimated_count as f64 * 10.0; // 10 min penalty per estimate
                let max_time_penalty = (max_time - avg_time) * 0.5; // Penalty for uneven times
                let score = avg_time + estimation_penalty + max_time_penalty;

                CandidateScore {
                    location: candidate,
                    routes,
                    total_time,
                    max_time,
                    estimated_count,
                    score,
                }
            }
        }).collect();

        let scored_candidates = join_all(candidate_futures).await;
        Ok(scored_candidates)
    }

    /// Select the best candidate based on scores
    fn select_best_candidate(
        origins: &[(String, Location)],
        mut scored_candidates: Vec<CandidateScore>,
    ) -> anyhow::Result<(MeetingPoint, Vec<Route>)> {
        if scored_candidates.is_empty() {
            return Self::geometric_fallback(origins);
        }

        // Sort by score (lower is better)
        scored_candidates.sort_by(|a, b| a.score.partial_cmp(&b.score).unwrap_or(std::cmp::Ordering::Equal));
        
        let best_candidate = scored_candidates.into_iter().next().unwrap();
        
        info!("Selected best candidate with score: {:.2}", best_candidate.score);

        // Build travel times from routes
        let travel_times: Vec<TravelTime> = best_candidate.routes.iter().map(|route| {
            let duration_minutes = if !route.steps.is_empty() {
                route.steps.iter().map(|step| step.duration).sum::<u32>() / 60
            } else {
                let origin = origins.iter().find(|(id, _)| id == &route.id).unwrap().1.clone();
                let distance = origin.distance_to(&best_candidate.location);
                Self::estimate_travel_time(distance)
            };

            TravelTime {
                id: route.id.clone(),
                address: origins.iter()
                    .find(|(id, _)| id == &route.id)
                    .map(|(_, loc)| loc.address.clone().unwrap_or_default())
                    .unwrap_or_default(),
                duration: duration_minutes,
                distance: origins.iter()
                    .find(|(id, _)| id == &route.id)
                    .map(|(_, loc)| loc.distance_to(&best_candidate.location))
                    .unwrap_or(0.0),
                estimated: route.steps.is_empty(),
                transit_summary: Some("🚌 Public Transport".to_string()),
            }
        }).collect();

        let meeting_point = MeetingPoint {
            name: if best_candidate.estimated_count == 0 {
                "Candidate Points Meeting Point".to_string()
            } else {
                format!("Candidate Points Meeting Point ({} estimated)", best_candidate.estimated_count)
            },
            coordinates: (best_candidate.location.longitude, best_candidate.location.latitude),
            travel_times,
        };

        Ok((meeting_point, best_candidate.routes))
    }

    /// Geometric fallback when all candidates fail
    fn geometric_fallback(origins: &[(String, Location)]) -> anyhow::Result<(MeetingPoint, Vec<Route>)> {
        warn!("Using geometric fallback");
        
        let centroid = Self::geometric_centroid(origins);
        
        let travel_times: Vec<TravelTime> = origins.iter().map(|(id, location)| {
            let distance = location.distance_to(&centroid);
            let duration_minutes = Self::estimate_travel_time(distance);
            
            TravelTime {
                id: id.clone(),
                address: location.address.clone().unwrap_or_default(),
                duration: duration_minutes,
                distance,
                estimated: true,
                transit_summary: Some("🚶 Walking (estimated)".to_string()),
            }
        }).collect();

        let routes: Vec<Route> = origins.iter().map(|(id, location)| {
            Route {
                id: id.clone(),
                geometry: LineString::new(vec![
                    (location.longitude, location.latitude),
                    (centroid.longitude, centroid.latitude),
                ]),
                steps: vec![],
            }
        }).collect();

        let meeting_point = MeetingPoint {
            name: "Geometric Center (Fallback)".to_string(),
            coordinates: (centroid.longitude, centroid.latitude),
            travel_times,
        };

        Ok((meeting_point, routes))
    }

    /// Calculate geometric centroid of locations
    fn geometric_centroid(locations: &[(String, Location)]) -> Location {
        let points: Vec<Point<f64>> = locations
            .iter()
            .map(|(_, loc)| loc.to_point())
            .collect();

        let multi_point = MultiPoint::new(points);
        let centroid_point = multi_point.centroid().unwrap();
        Location::new(centroid_point.y(), centroid_point.x())
    }

    /// Extract simple geometry from transit steps
    fn extract_simple_geometry(
        steps: &[crate::models::transit::TransitStep],
        from: &Location,
        to: &Location,
    ) -> Vec<(f64, f64)> {
        if steps.is_empty() {
            return vec![
                (from.longitude, from.latitude),
                (to.longitude, to.latitude),
            ];
        }

        let mut geometry = vec![
            (from.longitude, from.latitude),
            (to.longitude, to.latitude),
        ];
        
        // Extract key points from steps (keep it simple)
        for step in steps.iter().take(5) {
            if let Some(ref geom) = step.geometry {
                if let Some(first_coord) = geom.coordinates.first() {
                    if first_coord.len() >= 2 {
                        geometry.push((first_coord[0], first_coord[1]));
                    }
                }
                if let Some(last_coord) = geom.coordinates.last() {
                    if last_coord.len() >= 2 {
                        geometry.push((last_coord[0], last_coord[1]));
                    }
                }
            }
        }
        
        geometry
    }

    /// Estimate travel time based on distance (walking speed)
    fn estimate_travel_time(distance_meters: f64) -> u32 {
        let speed_kmh = 20.0; // Average speed for mixed transport
        let distance_km = distance_meters / 1000.0;
        let time_hours = distance_km / speed_kmh;
        (time_hours * 60.0).round() as u32
    }
}