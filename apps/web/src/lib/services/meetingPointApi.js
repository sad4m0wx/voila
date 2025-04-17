// src/lib/services/meetingPointApi.js
// Service to interact with the Rust API

/**
 * Find the optimal meeting point using the Rust API
 * @param {Array} addresses - Array of address objects with id, value, and coordinates
 * @returns {Promise} - Promise resolving to the meeting point result
 */
export async function findOptimalMeetingPoint(addresses) {
    try {
      if (!addresses || addresses.length < 2) {
        throw new Error('At least two addresses are required');
      }
      
      // Format the request body to match the Rust API format
      const requestBody = {
        addresses: addresses.map(addr => ({
          id: String(addr.id), // Ensure id is a string
          address: addr.value || null,
          coordinates: addr.coordinates ? [addr.coordinates[0], addr.coordinates[1]] : null
        }))
      };
      
      console.log('Sending request to Rust API:', JSON.stringify(requestBody, null, 2));
      
      // Call the Rust API
      const response = await fetch('http://localhost:3000/api/meeting-point', {
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
          throw new Error(errorData.error || 'Failed to calculate meeting point');
        } catch (parseError) {
          // If parsing failed, use the raw error text
          throw new Error(`API Error (${response.status}): ${errorText.substring(0, 100)}`);
        }
      }
      
      // Parse the response
      const data = await response.json();
      console.log('API response:', data);
      
      // Convert the Rust API response format to the format expected by the SvelteKit app
      return {
        coordinates: data.meeting_point.coordinates,
        name: data.meeting_point.name,
        travelTimes: data.meeting_point.travel_times.map(time => ({
          id: time.id,
          address: time.address,
          duration: time.duration,
          distance: time.distance,
          estimated: time.estimated,
          transitSummary: time.transit_summary || 'Walking'
        })),
        routes: data.routes.map(route => ({
          id: route.id,
          geometry: {
            type: route.geometry.type,
            coordinates: route.geometry.coordinates
          }
        }))
      };
    } catch (error) {
      console.error('Error finding optimal meeting point:', error);
      throw error;
    }
  }
  
  /**
   * Get transit directions between two points
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
      
      const response = await fetch('http://localhost:3000/api/transit/directions', {
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
        transitAvailable: false, // For now, our basic API doesn't support transit details
        walkingOnly: true,
        transitSummary: '🚶 Walking',
        transitLines: []
      };
    } catch (error) {
      console.error('Failed to get transit directions:', error);
      throw error;
    }
  }