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
      return {
        name: primaryMeetingPoint.name,
        coordinates: primaryMeetingPoint.coordinates,
        travelTimes: primaryMeetingPoint.travel_times.map(tt => ({
          id: tt.id,
          address: tt.address,
          duration: tt.duration,
          distance: tt.distance,
          estimated: tt.estimated,
          transitSummary: tt.transit_summary
        })),
        routes: primaryRoutes.map((route, routeIndex) => {
          // Improved coordinate reconstruction with better deduplication
          const allCoordinates = [];
          
          if (route.steps && route.steps.length > 0) {
            route.steps.forEach((step, stepIndex) => {
              if (step.geometry && step.geometry.coordinates && Array.isArray(step.geometry.coordinates) && step.geometry.coordinates.length > 0) {
                const stepCoords = step.geometry.coordinates;
                
                stepCoords.forEach((coord, coordIndex) => {
                  // Validate coordinate format [lng, lat]
                  if (Array.isArray(coord) && coord.length >= 2 && 
                      typeof coord[0] === 'number' && typeof coord[1] === 'number') {
                    
                    // Check for duplicates with a small tolerance for floating point errors
                    const isDuplicate = allCoordinates.length > 0 && 
                      Math.abs(allCoordinates[allCoordinates.length - 1][0] - coord[0]) < 0.000001 &&
                      Math.abs(allCoordinates[allCoordinates.length - 1][1] - coord[1]) < 0.000001;
                    
                    if (!isDuplicate) {
                      allCoordinates.push([coord[0], coord[1]]);
                    }
                  }
                });
              }
            });
          }
          
          // If we don't have coordinates from steps, try using the route's geometry directly
          if (allCoordinates.length < 2 && route.geometry && route.geometry.coordinates) {
            route.geometry.coordinates.forEach(coord => {
              if (Array.isArray(coord) && coord.length >= 2 && 
                  typeof coord[0] === 'number' && typeof coord[1] === 'number') {
                allCoordinates.push([coord[0], coord[1]]);
              }
            });
          }
          
          console.log(`Route ${routeIndex}: Reconstructed ${allCoordinates.length} coordinates from ${route.steps?.length || 0} steps`);
          
          return {
            id: route.id || `route-${routeIndex}`,
            geometry: {
              type: "LineString",
              coordinates: allCoordinates
            },
            steps: route.steps,
            color: route.color || getRouteColor(routeIndex),
            weight: 5
          };
        }),
        venues: rustResponse.venues || [],
        // Include debug data for visualization
        debug: rustResponse.debug_data || null,
        // Include all meeting points and routes
        allMeetingPoints: meetingPoints,
        allRoutes: allRoutes.map(routeSet => 
          routeSet.map((route, routeIndex) => {
            // Improved coordinate reconstruction with better deduplication
            const allCoordinates = [];
            
            if (route.steps && route.steps.length > 0) {
              route.steps.forEach((step, stepIndex) => {
                if (step.geometry && step.geometry.coordinates && Array.isArray(step.geometry.coordinates) && step.geometry.coordinates.length > 0) {
                  const stepCoords = step.geometry.coordinates;
                  
                  stepCoords.forEach((coord, coordIndex) => {
                    // Validate coordinate format [lng, lat]
                    if (Array.isArray(coord) && coord.length >= 2 && 
                        typeof coord[0] === 'number' && typeof coord[1] === 'number') {
                      
                      // Check for duplicates with a small tolerance for floating point errors
                      const isDuplicate = allCoordinates.length > 0 && 
                        Math.abs(allCoordinates[allCoordinates.length - 1][0] - coord[0]) < 0.000001 &&
                        Math.abs(allCoordinates[allCoordinates.length - 1][1] - coord[1]) < 0.000001;
                      
                      if (!isDuplicate) {
                        allCoordinates.push([coord[0], coord[1]]);
                      }
                    }
                  });
                }
              });
            }
            
            // If we don't have coordinates from steps, try using the route's geometry directly
            if (allCoordinates.length < 2 && route.geometry && route.geometry.coordinates) {
              route.geometry.coordinates.forEach(coord => {
                if (Array.isArray(coord) && coord.length >= 2 && 
                    typeof coord[0] === 'number' && typeof coord[1] === 'number') {
                  allCoordinates.push([coord[0], coord[1]]);
                }
              });
            }
            
            return {
              id: route.id || `route-${routeIndex}`,
              geometry: {
                type: "LineString",
                coordinates: allCoordinates
              },
              steps: route.steps,
              color: route.color || getRouteColor(routeIndex),
              weight: 5
            };
          })
        )
      };
    } catch (apiError) {
      console.error('Error from Rust API, falling back to centroid calculation:', apiError);

      // Fall back to simple centroid calculation
      return {
        name: "Simple Meeting Point",
        coordinates: findCentroid(addressesWithCoordinates.map(addr => addr.coordinates)),
        travelTimes: addressesWithCoordinates.map(addr => ({
          id: addr.id,
          address: addr.value,
          duration: 10, // Placeholder duration
          estimated: true
        })),
        routes: [],
        venues: [],
        debug: null // No debug data in fallback
      };
    }
  } catch (error) {
    console.error('Error finding optimal meeting point:', error);
    throw error;
  }
}

function getRouteColor(index) {
  const colors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b']; // Indigo, Purple, Cyan, Green, Orange
  return colors[index % colors.length];
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