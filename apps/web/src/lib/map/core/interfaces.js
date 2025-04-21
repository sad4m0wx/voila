/**
 * Interface for map services across platforms
 * @interface
 */
export class MapService {
    /**
     * Initialize the map service
     * @param {string} [apiKey] - Optional API key for the service
     * @returns {Promise<void>}
     */
    async initialize(apiKey) {
      throw new Error('Method not implemented');
    }
    
    /**
     * Check if the map service is ready
     * @returns {boolean}
     */
    isReady() {
      throw new Error('Method not implemented');
    }
    
    /**
     * Wait for the map service to be ready
     * @param {number} [timeoutMs=10000] - Timeout in milliseconds
     * @returns {Promise<void>}
     */
    async waitForReady(timeoutMs = 10000) {
      throw new Error('Method not implemented');
    }
    
    /**
     * Geocode an address to coordinates
     * @param {string} address - The address to geocode
     * @returns {Promise<import('./types').Address>}
     */
    async geocodeAddress(address) {
      throw new Error('Method not implemented');
    }
    
    /**
     * Get directions between two points
     * @param {import('./types').Coordinates} origin - Origin coordinates [lng, lat]
     * @param {import('./types').Coordinates} destination - Destination coordinates [lng, lat]
     * @param {string} [mode='transit'] - Transportation mode (driving, walking, transit)
     * @returns {Promise<import('./types').Route>} - Directions result
     */
    async getDirections(origin, destination, mode = 'transit') {
      throw new Error('Method not implemented');
    }
    
    /**
     * Find nearby places
     * @param {import('./types').Coordinates} location - Location coordinates [lng, lat]
     * @param {string} [type='restaurant'] - Type of places to find
     * @param {number} [radius=500] - Search radius in meters
     * @returns {Promise<Array<import('./types').Place>>} - Array of places
     */
    async findNearbyPlaces(location, type = 'restaurant', radius = 500) {
      throw new Error('Method not implemented');
    }
    
    /**
     * Extract transit information from directions
     * @param {import('./types').Route} directions - Directions result
     * @returns {import('./types').TransitInfo} - Transit information
     */
    extractTransitInfo(directions) {
      throw new Error('Method not implemented');
    }
  }