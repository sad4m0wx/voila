// src/lib/services/transitDirectionsWithCache.js
import { isGoogleMapsLoaded } from './googleMapsProxy';
import { getDirections, extractTransitInfo } from './googleMapsProxy';

// Create caches
const directionsCache = new Map();
const gridSearchCache = new Map();

/**
 * Get public transit directions between two points with caching
 */
export async function getTransitDirections(origin, destination) {
  // Create cache key using origin and destination coordinates
  const cacheKey = getCacheKey(origin, destination);
  
  // Check if we have a cached result
  if (directionsCache.has(cacheKey)) {
    console.log('Using cached directions');
    return directionsCache.get(cacheKey);
  }

  try {
    // Get directions from server proxy
    const directions = await getDirections(origin, destination, 'transit');
    
    // Add transit summary information
    const transitInfo = extractTransitInfo(directions);
    const result = {
      ...directions,
      ...transitInfo
    };
    
    // Cache the result
    directionsCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Failed to get transit directions:', error);
    
    // Try walking as a fallback
    try {
      const walkingDirections = await getDirections(origin, destination, 'walking');
      
      // Format walking directions
      const result = {
        ...walkingDirections,
        transitLines: [],
        transitSummary: '🚶 Walking',
        transitAvailable: false,
        walkingOnly: true
      };
      
      // Cache the walking result
      directionsCache.set(cacheKey, result);
      return result;
    } catch (walkingError) {
      console.error('Walking directions error:', walkingError);
      throw error; // Throw the original error
    }
  }
}

/**
 * Find an optimal meeting point based on travel times
 * Uses cached grid search results when possible
 */
export async function findOptimalMeetingPoint(addresses) {
  try {
    if (!addresses || addresses.length < 2) {
      throw new Error('At least two addresses are required');
    }
    
    // Create a cache key based on addresses
    const cacheKey = addresses.map(addr => 
      `${addr.id}:${addr.coordinates ? addr.coordinates.join(',') : addr.value}`
    ).sort().join('|');
    
    // Check if we have a cached result
    if (gridSearchCache.has(cacheKey)) {
      console.log('Using cached meeting point result');
      return gridSearchCache.get(cacheKey);
    }
    
    // Start with the geometric center
    const allCoordinates = addresses.map(addr => addr.coordinates);
    const centroid = findCentroid(allCoordinates);
    
    // Set a timeout for the grid search
    const timeout = setTimeout(() => {
      console.log('Grid search is taking longer than expected...');
    }, 10000); // 10 seconds warning
    
    try {
      // Use a smaller grid size to reduce API calls
      let bestPoint = await gridSearch(addresses, centroid, 0.01, 3);
      
      // Only do a refined search if we have time/quota available
      bestPoint = await gridSearch(addresses, bestPoint.coordinates, 0.002, 3);
      
      // Get detailed routes for the final meeting point
      const routes = await Promise.all(
        addresses.map(async (addr) => {
          try {
            return await getTransitDirections(
              addr.coordinates,
              bestPoint.coordinates
            );
          } catch (error) {
            console.error(`Error getting route for ${addr.value}:`, error);
            // Return a fallback with minimal data
            return {
              startAddress: addr.value,
              endAddress: "Meeting Point",
              duration: bestPoint.travelTimes.find(t => t.id === addr.id)?.duration * 60 || 0,
              distance: 0,
              geometry: {
                type: 'LineString',
                coordinates: [addr.coordinates, bestPoint.coordinates]
              },
              error: error.message
            };
          }
        })
      );
      
      // Update travel times with the actual route data
      const updatedTravelTimes = bestPoint.travelTimes.map(time => {
        const route = routes.find(r => 
          r.startAddress === addresses.find(a => a.id === time.id)?.value
        );
        
        if (route) {
          return {
            ...time,
            duration: Math.round(route.duration / 60), // Convert seconds to minutes
            distance: route.distance,
            transitDetails: route.steps?.some(s => s.mode === 'transit')
              ? 'Public Transit'
              : 'Walking',
            transitLines: route.transitLines || [],
            transitSummary: route.transitSummary || 'Walking'
          };
        }
        return time;
      });
      
      const result = {
        ...bestPoint,
        travelTimes: updatedTravelTimes,
        routes: routes.map((route, index) => ({
          id: addresses[index].id,
          geometry: route.geometry
        }))
      };
      
      // Cache the result
      gridSearchCache.set(cacheKey, result);
      
      return result;
    } finally {
      clearTimeout(timeout); // Clear the timeout
    }
  } catch (error) {
    console.error('Error finding optimal meeting point:', error);
    throw error;
  }
}

/**
 * Grid search with optimized performance
 */
async function gridSearch(addresses, centerPoint, stepSize, gridSize) {
  // Generate a smaller grid to reduce API calls
  const gridPoints = generateGrid(centerPoint, stepSize, gridSize);
  let bestPoint = null;
  let bestScore = Infinity;
  
  // Set up concurrency limits to avoid overwhelming the API
  const concurrencyLimit = 2;
  let activeRequests = 0;
  
  // Evaluate each grid point with limited concurrency
  for (let i = 0; i < gridPoints.length; i++) {
    const point = gridPoints[i];
    
    // Wait if we've hit the concurrency limit
    while (activeRequests >= concurrencyLimit) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    activeRequests++;
    
    try {
      // Find a cache key for this grid point evaluation
      const gridPointKey = `grid:${point.join(',')}-${addresses.map(a => a.id).join(',')}`;
      
      // Check if we already evaluated this point
      if (gridSearchCache.has(gridPointKey)) {
        const cachedResult = gridSearchCache.get(gridPointKey);
        if (cachedResult.score < bestScore) {
          bestScore = cachedResult.score;
          bestPoint = cachedResult.point;
        }
        continue;
      }
      
      // Estimate travel times for all addresses to this point
      const travelTimes = await Promise.all(
        addresses.map(async (addr) => {
          try {
            const route = await getTransitDirections(addr.coordinates, point);
            return {
              id: addr.id,
              address: addr.value,
              duration: Math.round(route.duration / 60), // Convert to minutes
              distance: route.distance
            };
          } catch (error) {
            // If directions fail, use a fallback calculation
            console.warn(`Couldn't get directions from ${addr.value} to point:`, error);
            const estimatedTime = estimateTravelTime(addr.coordinates, point);
            return {
              id: addr.id,
              address: addr.value,
              duration: estimatedTime,
              distance: estimateDistance(addr.coordinates, point),
              estimated: true
            };
          }
        })
      );
      
      // Calculate the score (maximum travel time for any person)
      const maxTime = Math.max(...travelTimes.map(time => time.duration));
      const totalTime = travelTimes.reduce((sum, time) => sum + time.duration, 0);
      
      // Score is primarily the max time, with total time as a tiebreaker
      const score = maxTime + (totalTime / 1000);
      
      // Cache the evaluation result
      gridSearchCache.set(gridPointKey, {
        score,
        point: {
          coordinates: point,
          name: "Optimal Meeting Point",
          travelTimes
        }
      });
      
      if (score < bestScore) {
        bestScore = score;
        bestPoint = {
          coordinates: point,
          name: "Optimal Meeting Point",
          travelTimes
        };
      }
    } catch (error) {
      console.warn(`Error evaluating point ${point}:`, error);
    } finally {
      activeRequests--;
    }
  }
  
  // If we couldn't find a better point, return the center point
  if (!bestPoint) {
    const fallbackTimes = addresses.map(addr => ({
      id: addr.id,
      address: addr.value,
      duration: estimateTravelTime(addr.coordinates, centerPoint),
      distance: estimateDistance(addr.coordinates, centerPoint),
      estimated: true
    }));
    
    bestPoint = {
      coordinates: centerPoint,
      name: "Approximate Meeting Point",
      travelTimes: fallbackTimes
    };
  }
  
  return bestPoint;
}

/**
 * Generate a cache key from coordinates
 */
function getCacheKey(origin, destination, mode = 'transit') {
  // Convert coordinates to strings
  const originStr = Array.isArray(origin) 
    ? `${origin[0].toFixed(6)},${origin[1].toFixed(6)}` 
    : `${origin.lng().toFixed(6)},${origin.lat().toFixed(6)}`;
    
  const destStr = Array.isArray(destination) 
    ? `${destination[0].toFixed(6)},${destination[1].toFixed(6)}`
    : `${destination.lng().toFixed(6)},${destination.lat().toFixed(6)}`;
  
  // Create a cache key (include the mode to differentiate transit vs walking)
  return `${mode}:${originStr}-${destStr}`;
}

/**
 * Clear all caches (useful if location data changes significantly)
 */
export function clearAllCaches() {
  directionsCache.clear();
  gridSearchCache.clear();
  console.log('All direction and grid search caches cleared');
}

/**
 * Generate a grid of points around a center point
 * Optimized to produce fewer points for better performance
 */
function generateGrid(center, stepSize, gridSize) {
  const points = [];
  const half = Math.floor(gridSize / 2);
  
  for (let i = -half; i <= half; i++) {
    for (let j = -half; j <= half; j++) {
      points.push([
        center[0] + i * stepSize,
        center[1] + j * stepSize
      ]);
    }
  }
  
  return points;
}

/**
 * Find the geometric center of multiple coordinates
 */
function findCentroid(coordinates) {
  const n = coordinates.length;
  
  // Sum all coordinates
  const sum = coordinates.reduce(
    (acc, coord) => {
      return [acc[0] + coord[0], acc[1] + coord[1]];
    },
    [0, 0]
  );
  
  // Divide by number of points to get average
  return [sum[0] / n, sum[1] / n];
}

/**
 * Estimate travel time between two points (used as fallback)
 */
function estimateTravelTime(origin, destination) {
  const distance = estimateDistance(origin, destination);
  const averageSpeedKmh = 20; // Lower average speed for urban transit
  
  // Convert distance to km and calculate time in minutes
  const timeMinutes = (distance / 1000) / (averageSpeedKmh / 60);
  
  return Math.round(timeMinutes);
}

/**
 * Estimate distance between two coordinates (Haversine formula)
 */
function estimateDistance(coord1, coord2) {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return distance;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}