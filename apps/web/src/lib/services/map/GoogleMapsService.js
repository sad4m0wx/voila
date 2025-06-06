import { isGoogleMapsLoaded, loadGoogleMapsScript } from './googleMapsLoader.js';

export class GoogleMapsService {

    constructor(apiKey = null) {
        this.apiKey = apiKey;
    }

    async initialize(newApiKey = null) {
        const apiKey = newApiKey || this.apiKey;
        await loadGoogleMapsScript(apiKey);
    }
    
    async geocodeAddress(address) {
        if (!isGoogleMapsLoaded()) {
            await this.initialize();
        }

        try {
            const response = await fetch('/api/maps', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'geocode',
                    payload: { address }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Geocoding failed');
            }

            const result = await response.json();

            return {
                formatted: result.address,
                coordinates: result.coordinates,
                placeId: result.placeId
            };
        } catch (error) {
            console.error('Geocoding error:', error);
            throw error;
        }
    }
}

// Create a singleton instance
export const googleMapsService = new GoogleMapsService();