import { googleMapsService } from './map';
import { CORE_API_URL } from '../config';

/**
 * Find the optimal meeting point using the Rust backend API
 * @param {Array} addresses - Array of address objects with id, value, and coordinates
 * @param {Object} options - Options for the meeting point calculation
 * @param {Array} options.venueTypes - Array of venue types to search for
 * @param {Number} options.venueRadius - Radius in meters to search for venues
 * @param {Boolean} options.showVenues - Whether to include venues in the result
 * @returns {Promise} - Promise resolving to the meeting point result
 */
export async function findOptimalMeetingPoint(addresses, options = {}) {
  try {
    if (!addresses || addresses.length < 2) {
      throw new Error('At least two addresses are required');
    }

    // Set default options
    const { 
      venueTypes = ["restaurant"], 
      venueRadius = 500, 
      showVenues = true 
    } = options;

    // Make sure all addresses have coordinates
    const addressesWithCoordinates = await Promise.all(
      addresses.map(async (addr) => {
        if (addr.coordinates) {
          return addr;
        }

        // Geocode addresses without coordinates
        try {
          const geocodeResult = await googleMapsService.geocodeAddress(addr.value);
          return {
            ...addr,
            coordinates: geocodeResult.coordinates
          };
        } catch (err) {
          console.error(`Failed to geocode address: ${addr.value}`, err);
          return addr;
        }
      })
    );

    // Format the request body for the API
    const requestBody = {
      addresses: addressesWithCoordinates.map(addr => ({
        id: String(addr.id), // Ensure id is a string
        address: addr.value || null,
        coordinates: addr.coordinates ? [addr.coordinates[0], addr.coordinates[1]] : null
      })),
      departure_time: Math.floor(Date.now() / 1000), // Current time as Unix timestamp
      include_venues: showVenues,
      venue_options: {
        types: venueTypes,
        radius: venueRadius
      }
    };

    try {
      const response = await fetch(CORE_API_URL + '/api/meeting-point', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText || 'Failed to calculate meeting point API'}`);
      }

      const rustResponse = await response.json();

      // Handle the new multiple meeting points structure
      const meetingPoints = rustResponse.meeting_points || [];
      const allRoutes = rustResponse.routes || [];

      if (!meetingPoints.length) {
        throw new Error('No meeting points returned from API');
      }

      // Use the first meeting point as the primary one for backward compatibility
      const primaryMeetingPoint = meetingPoints[0];
      const primaryRoutes = allRoutes[0] || [];

      // Transform the Rust API response to match what our frontend expects
      const transformedResult = {
        name: primaryMeetingPoint.name,
        coordinates: primaryMeetingPoint.coordinates,
        travelTimes: primaryMeetingPoint.travel_times.map(tt => {
          // The API returns duration in minutes - RouteDetails expects minutes
          let durationInMinutes = tt.duration;
          
          // If duration is a string with format "XX min", parse it
          if (typeof tt.duration === 'string') {
            const match = tt.duration.match(/(\d+)\s*(min|minutes|sec|seconds)/i);
            if (match) {
              const value = parseInt(match[1]);
              const unit = match[2].toLowerCase();
              durationInMinutes = unit.startsWith('min') ? value : Math.round(value / 60);
            } else {
              // Try to parse as a number - if it's a number, assume it's minutes from the API
              durationInMinutes = parseInt(tt.duration) || 0;
            }
          } else if (typeof tt.duration === 'number') {
            // API returns duration in minutes, use as-is
            durationInMinutes = tt.duration;
          }
          
          // Ensure duration is a reasonable number (not negative, not too huge)
          if (!durationInMinutes || durationInMinutes < 0 || durationInMinutes > 120) { // Max 2 hours
            durationInMinutes = 0;
          }
          
          console.log(`Travel time for ${tt.address}: ${tt.duration} minutes -> ${durationInMinutes} minutes (for RouteDetails)`);
          
          return {
            id: tt.id,
            address: tt.address,
            duration: durationInMinutes, // Keep in minutes for RouteDetails component
            distance: tt.distance,
            estimated: tt.estimated || false,
            transitSummary: tt.transit_summary
          };
        }),
                routes: (() => {
          const processedRoutes = [];
          
          primaryRoutes.forEach((route, routeIndex) => {
            // Process each step as a separate route segment - matching SvelteKit approach
            if (route.steps && route.steps.length > 0) {
              route.steps.forEach((step, stepIndex) => {
                if (!step.geometry || !step.geometry.coordinates || !Array.isArray(step.geometry.coordinates)) {
                  return;
                }
                
                const stepCoords = step.geometry.coordinates;
                if (stepCoords.length < 2) {
                  return;
                }
                
                // Create path from the step's detailed coordinates
                const validCoordinates = stepCoords
                  .filter(coord => 
                    Array.isArray(coord) && 
                    coord.length >= 2 && 
                    typeof coord[0] === 'number' && 
                    typeof coord[1] === 'number' &&
                    Math.abs(coord[0]) <= 180 && 
                    Math.abs(coord[1]) <= 90
                  );
                
                if (validCoordinates.length < 2) {
                  return;
                }
                
                // Remove duplicate consecutive coordinates
                const dedupedCoordinates = [];
                validCoordinates.forEach((coord, i) => {
                  if (i === 0 || 
                      Math.abs(coord[0] - validCoordinates[i-1][0]) > 0.000001 ||
                      Math.abs(coord[1] - validCoordinates[i-1][1]) > 0.000001) {
                    dedupedCoordinates.push([coord[0], coord[1]]);
                  }
                });
                
                if (dedupedCoordinates.length >= 2) {
                  processedRoutes.push({
                    id: `route-${routeIndex}-step-${stepIndex}`,
                    geometry: {
                      type: "LineString",
                      coordinates: dedupedCoordinates
                    },
                    step: step,
                    color: getStepColor(step),
                    weight: step.mode === 'walking' ? 3 : 5,
                    opacity: 0.8,
                    mode: step.mode
                  });
                }
              });
            } else {
              // Fallback to main route geometry if no steps
              const allCoordinates = [];
              
              if (route.geometry && route.geometry.coordinates) {
                route.geometry.coordinates.forEach(coord => {
                  if (Array.isArray(coord) && coord.length >= 2 && 
                      typeof coord[0] === 'number' && typeof coord[1] === 'number') {
                    allCoordinates.push([coord[0], coord[1]]);
                  }
                });
              }
              
              if (allCoordinates.length >= 2) {
                processedRoutes.push({
                  id: route.id || `route-${routeIndex}`,
                  geometry: {
                    type: "LineString",
                    coordinates: allCoordinates
                  },
                  steps: route.steps,
                  color: route.color || getRouteColor(routeIndex),
                  weight: route.stroke_width || 5,
                  opacity: route.opacity || 0.8,
                  mode: route.travel_mode || route.mode
                });
              }
            }
          });
          
          return processedRoutes;
        })(),
        venues: rustResponse.venues || [],
        // Include debug data for visualization
        debug: rustResponse.debug_data || null,
        // Include all meeting points for swipeable interface
        allMeetingPoints: meetingPoints.map((mp, mpIndex) => ({
          name: mp.name,
          coordinates: mp.coordinates,
          travelTimes: mp.travel_times.map(tt => ({
            id: tt.id,
            address: tt.address,
            duration: typeof tt.duration === 'number' ? tt.duration : parseInt(tt.duration) || 0,
            distance: tt.distance,
            estimated: tt.estimated || false,
            transitSummary: tt.transit_summary
          })),
          routes: (() => {
            const processedRoutes = [];
            const mpRoutes = allRoutes[mpIndex] || [];
            
            mpRoutes.forEach((route, routeIndex) => {
              // Process each step as a separate route segment
              if (route.steps && route.steps.length > 0) {
                route.steps.forEach((step, stepIndex) => {
                  if (!step.geometry || !step.geometry.coordinates || !Array.isArray(step.geometry.coordinates)) {
                    return;
                  }
                  
                  const stepCoords = step.geometry.coordinates;
                  if (stepCoords.length < 2) {
                    return;
                  }
                  
                  const validCoordinates = stepCoords
                    .filter(coord => 
                      Array.isArray(coord) && 
                      coord.length >= 2 && 
                      typeof coord[0] === 'number' && 
                      typeof coord[1] === 'number' &&
                      Math.abs(coord[0]) <= 180 && 
                      Math.abs(coord[1]) <= 90
                    );
                  
                  if (validCoordinates.length < 2) {
                    return;
                  }
                  
                  const dedupedCoordinates = [];
                  validCoordinates.forEach((coord, i) => {
                    if (i === 0 || 
                        Math.abs(coord[0] - validCoordinates[i-1][0]) > 0.000001 ||
                        Math.abs(coord[1] - validCoordinates[i-1][1]) > 0.000001) {
                      dedupedCoordinates.push([coord[0], coord[1]]);
                    }
                  });
                  
                  if (dedupedCoordinates.length >= 2) {
                    processedRoutes.push({
                      id: `route-${mpIndex}-${routeIndex}-step-${stepIndex}`,
                      geometry: {
                        type: "LineString",
                        coordinates: dedupedCoordinates
                      },
                      step: step,
                      color: getStepColor(step),
                      weight: step.mode === 'walking' ? 3 : 5,
                      opacity: 0.8,
                      mode: step.mode
                    });
                  }
                });
              } else {
                // Fallback to main route geometry
                const allCoordinates = [];
                
                if (route.geometry && route.geometry.coordinates) {
                  route.geometry.coordinates.forEach(coord => {
                    if (Array.isArray(coord) && coord.length >= 2 && 
                        typeof coord[0] === 'number' && typeof coord[1] === 'number') {
                      allCoordinates.push([coord[0], coord[1]]);
                    }
                  });
                }
                
                if (allCoordinates.length >= 2) {
                  processedRoutes.push({
                    id: route.id || `route-${mpIndex}-${routeIndex}`,
                    geometry: {
                      type: "LineString",
                      coordinates: allCoordinates
                    },
                    steps: route.steps,
                    color: route.color || getRouteColor(routeIndex),
                    weight: route.stroke_width || 5,
                    opacity: route.opacity || 0.8,
                    mode: route.travel_mode || route.mode
                  });
                }
              }
            });
            
            return processedRoutes;
          })(),
          venues: rustResponse.venues || []
        }))
      };

      return transformedResult;
    } catch (apiError) {
      console.error('Error from Rust API, falling back to centroid calculation:', apiError);

      // Fall back to simple centroid calculation with better travel time estimates
      const centroid = findCentroid(addressesWithCoordinates.map(addr => addr.coordinates));
      
      // Calculate approximate travel times based on distance (rough estimate)
      const travelTimes = addressesWithCoordinates.map(addr => {
        const distance = calculateDistance(addr.coordinates, centroid);
        // Rough estimate: 30 km/h average speed in city traffic
        const estimatedDurationMinutes = Math.max(5, Math.round((distance / 30) * 60));
        
        console.log(`Fallback travel time for ${addr.value}: ${distance.toFixed(2)}km -> ${estimatedDurationMinutes} minutes`);
        
        return {
          id: addr.id,
          address: addr.value,
          duration: estimatedDurationMinutes, // Keep in minutes for RouteDetails component
          distance: distance * 1000, // Convert to meters
          estimated: true
        };
      });

      return {
        name: "Geographic Center",
        coordinates: centroid,
        travelTimes: travelTimes,
        routes: [],
        venues: [],
        debug: {
          fallbackReason: apiError.message,
          calculationMethod: "centroid"
        }
      };
    }
  } catch (error) {
    console.error('Error finding optimal meeting point:', error);
    throw error;
  }
}

function getRouteColor(index) {
  const colors = ['#1a73e8', '#e53935', '#43a047', '#fb8c00', '#8e24aa']; // Match SvelteKit colors
  return colors[index % colors.length];
}

function getStepColor(step) {
  // Color based on transport mode - matching SvelteKit implementation
  if (step.mode === 'walking') {
    return '#059669'; // Darker emerald for walking
  } else if (step.mode === 'transit') {
    // Use transit line color if available, otherwise purple
    return step.transit_details?.line?.color || '#7C3AED';
  } else if (step.mode === 'driving') {
    return '#2563EB'; // Darker blue for driving
  }
  return '#6366F1'; // Default indigo
}

/**
 * Find the geometric center of multiple coordinates
 */
function findCentroid(coordinates) {
  if (!coordinates || coordinates.length === 0) {
    return [0, 0]; // Default fallback
  }
  
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
 * Calculate distance between two coordinates using Haversine formula
 * @param {Array} coord1 - [lng, lat]
 * @param {Array} coord2 - [lng, lat]
 * @returns {Number} - Distance in kilometers
 */
function calculateDistance(coord1, coord2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(coord2[1] - coord1[1]);
  const dLng = toRadians(coord2[0] - coord1[0]);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coord1[1])) * Math.cos(toRadians(coord2[1])) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
} 