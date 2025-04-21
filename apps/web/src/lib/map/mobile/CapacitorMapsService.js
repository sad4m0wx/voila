import { MapService } from '../core/interfaces';

/**
 * Implementation of MapService for Capacitor (mobile)
 * @class
 */
export class CapacitorMapsService extends MapService {
  constructor() {
    super();
    // This is a placeholder implementation
    console.warn('CapacitorMapsService is not yet implemented');
  }
  
  async initialize() {
    throw new Error('CapacitorMapsService is not yet implemented');
  }
  
  isReady() {
    return false;
  }
  
  async waitForReady() {
    throw new Error('CapacitorMapsService is not yet implemented');
  }
  
  async geocodeAddress() {
    throw new Error('CapacitorMapsService is not yet implemented');
  }
  
  async getDirections() {
    throw new Error('CapacitorMapsService is not yet implemented');
  }
  
  async findNearbyPlaces() {
    throw new Error('CapacitorMapsService is not yet implemented');
  }
  
  extractTransitInfo() {
    throw new Error('CapacitorMapsService is not yet implemented');
  }
}

// Create a singleton instance
export const capacitorMapsService = new CapacitorMapsService();