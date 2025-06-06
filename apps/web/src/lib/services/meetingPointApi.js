import { googleMapsService } from '$services/map';

const CORE_API_URL = import.meta.env.VITE_CORE_API_URL || 'http://localhost:3000';

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

      // Transform the Rust API response to match what our frontend expects
      return {
        name: rustResponse.meeting_point.name,
        coordinates: rustResponse.meeting_point.coordinates,
        travelTimes: rustResponse.meeting_point.travel_times.map(tt => ({
          id: tt.id,
          address: tt.address,
          duration: tt.duration,
          distance: tt.distance,
          estimated: tt.estimated,
          transitSummary: tt.transit_summary
        })),
        routes: rustResponse.routes.map(route => ({
          id: route.id,
          geometry: {
            type: "LineString",
            coordinates: route.geometry.coordinates
          },
          steps: route.steps,
          // Map to format expected by Google Maps
          color: getRouteColor(rustResponse.routes.indexOf(route)),
          weight: 5
        })),
        venues: rustResponse.venues || [],
        // Include debug data for visualization
        debug: rustResponse.debug_data || null
      };
    } catch (apiError) {
      console.error('Error from Rust API, falling back to SvelteKit endpoint:', apiError);

      // Fall back to the SvelteKit server endpoint
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
  const colors = ['#1a73e8', '#e53935', '#43a047', '#fb8c00', '#8e24aa'];
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