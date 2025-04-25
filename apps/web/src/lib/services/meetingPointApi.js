// src/lib/services/meetingPointApi.js
import { googleMapsService } from '$map/web';

const CORE_API_URL = import.meta.env.VITE_CORE_API_URL || 'http://localhost:3000';
/**
 * Find the optimal meeting point using the Rust backend API
 * @param {Array} addresses - Array of address objects with id, value, and coordinates
 * @returns {Promise} - Promise resolving to the meeting point result
 */
export async function findOptimalMeetingPoint(addresses) {
  try {
    if (!addresses || addresses.length < 2) {
      throw new Error('At least two addresses are required');
    }

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
      include_venues: false, // Don't include venue recommendations for now
    };

    // Call the API server
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
        throw new Error(errorText || 'Failed to calculate meeting point using Rust API');
      }

      const rustResponse = await response.json();
      console.log('Rust API response:', rustResponse);

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
        }))
      };
    } catch (rustApiError) {
      console.error('Error from Rust API, falling back to SvelteKit endpoint:', rustApiError);

      // Fall back to the SvelteKit server endpoint
      const fallbackResponse = await fetch('/api/meetingPoint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ addresses: requestBody.addresses })
      });

      if (!fallbackResponse.ok) {
        const errorText = await fallbackResponse.text();
        throw new Error(errorText || 'Failed to calculate meeting point');
      }

      return await fallbackResponse.json();
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
 * Get transit directions between two points using the Rust API
 * @param {Array} origin - [longitude, latitude] coordinates
 * @param {Array} destination - [longitude, latitude] coordinates
 * @returns {Promise} - Promise resolving to the directions result
 */
export async function getTransitDirections(origin, destination) {
  try {
    const requestBody = {
      origin: origin,
      destination: destination
    };

    const response = await fetch(CORE_API_URL + '/api/itinerary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error response:', errorText);

      try {
        // Try to parse as JSON
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.error || 'Failed to get transit directions');
      } catch (parseError) {
        // If parsing failed, use the raw error text
        throw new Error(`API Error (${response.status}): ${errorText.substring(0, 100)}`);
      }
    }

    const data = await response.json();

    // Convert to the format expected by the app
    return {
      duration: data.duration,
      distance: data.distance,
      transitAvailable: !!data.steps?.some(step => step.mode === 'transit'),
      walkingOnly: !data.steps?.some(step => step.mode !== 'walking'),
      transitSummary: data.steps?.some(step => step.mode === 'transit')
        ? data.steps
          .filter(step => step.transit_details)
          .map(step => {
            const line = step.transit_details.line;
            const icon = getTransitIcon(line.vehicle_type);
            return `${icon} ${line.short_name || line.name}`;
          }).join(', ')
        : '🚶 Walking',
      transitLines: data.steps
        ?.filter(step => step.transit_details)
        .map(step => step.transit_details.line) || []
    };
  } catch (error) {
    console.error('Failed to get transit directions:', error);
    throw error;
  }
}

// Helper function to get transit icons
function getTransitIcon(type) {
  switch (type?.toLowerCase()) {
    case 'subway':
    case 'metro':
      return '🚇';
    case 'bus':
      return '🚌';
    case 'train':
      return '🚆';
    case 'tram':
    case 'light_rail':
      return '🚊';
    case 'ferry':
      return '⛴️';
    default:
      return '🚋';
  }
}