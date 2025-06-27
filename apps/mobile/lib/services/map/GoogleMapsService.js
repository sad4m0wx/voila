import { googleMapsConfig } from '../../config';

/**
 * Google Maps Service for React Native
 * Provides geocoding and reverse geocoding functionality
 */
export class GoogleMapsService {
  constructor(apiKey = null) {
    this.apiKey = apiKey || googleMapsConfig.apiKey;
  }

  async initialize(newApiKey = null) {
    this.apiKey = newApiKey || this.apiKey;
    // In React Native, we don't need to load scripts like in the browser
    return Promise.resolve();
  }

  /**
   * Geocode an address to get coordinates
   * @param {string} address - The address to geocode
   * @returns {Promise<{coordinates: [number, number], formatted: string, placeId: string}>}
   */
  async geocodeAddress(address) {
    try {
      if (!this.apiKey) {
        throw new Error('Google Maps API key not configured');
      }

      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${this.apiKey}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Geocoding request failed: ${response.status}`);
      }

      const result = await response.json();

      if (result.status !== 'OK') {
        throw new Error(result.error_message || `Geocoding failed: ${result.status}`);
      }

      if (!result.results || result.results.length === 0) {
        throw new Error('No results found for this address');
      }

      const firstResult = result.results[0];
      const location = firstResult.geometry.location;

      return {
        formatted: firstResult.formatted_address,
        coordinates: [location.lng, location.lat], // [longitude, latitude] format
        placeId: firstResult.place_id
      };
    } catch (error) {
      console.error('Geocoding error:', error);
      throw error;
    }
  }

  /**
   * Reverse geocode coordinates to get address
   * @param {number} latitude - Latitude coordinate
   * @param {number} longitude - Longitude coordinate  
   * @returns {Promise<{address: string, formatted: string, placeId: string}>}
   */
  async reverseGeocode(latitude, longitude) {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new Error('Valid latitude and longitude numbers are required');
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${this.apiKey}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Reverse geocoding request failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const result = data.results[0];
        
        return {
          address: result.formatted_address,
          formatted: result.formatted_address,
          placeId: result.place_id
        };
      } else {
        throw new Error(`Reverse geocoding failed: ${data.status} - ${data.error_message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      throw error;
    }
  }

  /**
   * Search for places using the Places API
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @param {[number, number]} options.location - Center point for search [lng, lat]
   * @param {number} options.radius - Search radius in meters
   * @returns {Promise<Array>} Array of place results
   */
  async searchPlaces(query, options = {}) {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    if (!query || typeof query !== 'string') {
      throw new Error('Valid search query is required');
    }

    try {
      const encodedQuery = encodeURIComponent(query);
      let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodedQuery}&key=${this.apiKey}`;
      
      if (options.location && Array.isArray(options.location) && options.location.length === 2) {
        url += `&location=${options.location[1]},${options.location[0]}`; // Places API uses lat,lng format
      }
      
      if (options.radius && typeof options.radius === 'number') {
        url += `&radius=${options.radius}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Places search request failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'OK' && data.results) {
        return data.results.map(place => ({
          placeId: place.place_id,
          name: place.name,
          address: place.formatted_address,
          coordinates: [place.geometry.location.lng, place.geometry.location.lat],
          rating: place.rating,
          types: place.types,
          priceLevel: place.price_level
        }));
      } else {
        throw new Error(`Places search failed: ${data.status} - ${data.error_message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error searching places:', error);
      throw error;
    }
  }

  /**
   * Check if the service is properly configured
   * @returns {boolean} True if API key is configured
   */
  isConfigured() {
    return !!this.apiKey;
  }

  async getPlacePredictions(input, bounds = null) {
    try {
      if (!this.apiKey) {
        throw new Error('Google Maps API key not configured');
      }

      if (!input || input.trim().length < 2) {
        return [];
      }

      let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=address&key=${this.apiKey}`;
      
      // Add bounds if provided
      if (bounds) {
        const { northeast, southwest } = bounds;
        url += `&location=${(northeast[1] + southwest[1]) / 2},${(northeast[0] + southwest[0]) / 2}`;
        url += `&radius=50000`; // 50km radius
      }

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Places request failed: ${response.status}`);
      }

      const result = await response.json();

      if (result.status !== 'OK' && result.status !== 'ZERO_RESULTS') {
        throw new Error(result.error_message || `Places request failed: ${result.status}`);
      }

      return result.predictions || [];
    } catch (error) {
      console.error('Places autocomplete error:', error);
      return [];
    }
  }

  async getPlaceDetails(placeId) {
    try {
      if (!this.apiKey) {
        throw new Error('Google Maps API key not configured');
      }

      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_address,geometry,name,place_id&key=${this.apiKey}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Place details request failed: ${response.status}`);
      }

      const result = await response.json();

      if (result.status !== 'OK') {
        throw new Error(result.error_message || `Place details failed: ${result.status}`);
      }

      if (!result.result) {
        throw new Error('No place details found');
      }

      const place = result.result;
      const location = place.geometry.location;

      return {
        address: place.formatted_address,
        location: {
          lat: location.lat,
          lng: location.lng
        },
        placeId: place.place_id,
        name: place.name
      };
    } catch (error) {
      console.error('Place details error:', error);
      throw error;
    }
  }
}

// Create a singleton instance
export const googleMapsService = new GoogleMapsService(); 