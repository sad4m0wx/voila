// src/lib/services/meetingPointApi.js
import { googleMapsService } from '$map/web';

/**
 * Find the optimal meeting point using the backend API
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
      }))
    };
    
    // Call the API server
    const response = await fetch('/api/meetingPoint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to calculate meeting point');
    }
    
    return await response.json();
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


  