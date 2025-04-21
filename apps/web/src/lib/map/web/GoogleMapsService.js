import { MapService } from '../core/interfaces';
import { isGoogleMapsLoaded, loadGoogleMapsScript, waitForGoogleMaps } from './GoogleMapsLoader';

/**
 * Implementation of MapService for Google Maps
 */
export class GoogleMapsService extends MapService {
    /**
     * Create a new GoogleMapsService
     * @param {string} [apiKey] - Optional API key for Google Maps
     */
    constructor(apiKey = null) {
        super();
        this.apiKey = apiKey;
    }

    /**
     * Initialize Google Maps
     * @param {string} [newApiKey] - Optional API key to override constructor value
     * @returns {Promise<void>}
     */
    async initialize(newApiKey = null) {
        const apiKey = newApiKey || this.apiKey;
        await loadGoogleMapsScript(apiKey);
    }

    /**
     * Check if Google Maps is ready
     * @returns {boolean}
     */
    isReady() {
        return isGoogleMapsLoaded();
    }

    /**
     * Wait for Google Maps to be ready
     * @param {number} [timeoutMs=10000] - Timeout in milliseconds
     * @returns {Promise<void>}
     */
    async waitForReady(timeoutMs = 10000) {
        await waitForGoogleMaps(timeoutMs);
    }

    /**
     * Geocode an address to coordinates
     * @param {string} address - The address to geocode
     * @returns {Promise<import('../core/types').Address>}
     */
    async geocodeAddress(address) {
        if (!this.isReady()) {
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

    /**
     * Get directions between two points
     * @param {import('../core/types').Coordinates} origin - Origin coordinates
     * @param {import('../core/types').Coordinates} destination - Destination coordinates
     * @param {string} [mode='transit'] - Transportation mode
     * @returns {Promise<import('../core/types').Route>}
     */
    async getDirections(origin, destination, mode = 'transit') {
        if (!this.isReady()) {
            await this.initialize();
        }

        try {
            const response = await fetch('/api/maps', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'directions',
                    payload: { origin, destination, mode }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Directions request failed');
            }

            return await response.json();
        } catch (error) {
            console.error('Directions error:', error);
            throw error;
        }
    }

    /**
     * Find nearby places
     * @param {import('../core/types').Coordinates} location - Location coordinates
     * @param {string} [type='restaurant'] - Type of places to find
     * @param {number} [radius=500] - Search radius in meters
     * @returns {Promise<Array<import('../core/types').Place>>}
     */
    async findNearbyPlaces(location, type = 'restaurant', radius = 500) {
        if (!this.isReady()) {
            await this.initialize();
        }

        try {
            const response = await fetch('/api/maps', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'places',
                    payload: { location, type, radius }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Places request failed');
            }

            return await response.json();
        } catch (error) {
            console.error('Places error:', error);
            throw error;
        }
    }

    /**
     * Extract transit information from directions
     * @param {import('../core/types').Route} directions - Directions result
     * @returns {import('../core/types').TransitInfo}
     */
    extractTransitInfo(directions) {
        if (!directions || !directions.steps) {
            return {
                transitLines: [],
                transitSummary: '🚶 Walking'
            };
        }

        const transitSteps = directions.steps.filter(step => step.transitDetails);

        if (transitSteps.length === 0) {
            return {
                transitLines: [],
                transitSummary: '🚶 Walking'
            };
        }

        const transitLines = transitSteps.map(step => {
            const details = step.transitDetails;
            const vehicleType = details.line.vehicle || 'transit';
            const lineName = details.line.shortName || details.line.name || '';

            return {
                type: vehicleType,
                line: lineName,
                color: details.line.color || '#1a73e8',
                from: details.departureStop,
                to: details.arrivalStop,
                numStops: details.numStops
            };
        });

        const transitSummary = transitLines.map(tl => {
            const icon = this._getTransitIcon(tl.type);
            return `${icon} ${tl.line} (${tl.from} → ${tl.to})`;
        }).join(', ');

        return {
            transitLines,
            transitSummary
        };
    }

    /**
     * Get an icon/emoji for a transit type
     * @private
     * @param {string} type - Transit type
     * @returns {string} - Emoji icon
     */
    _getTransitIcon(type) {
        switch (type.toLowerCase()) {
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
}

// Create a singleton instance
export const googleMapsService = new GoogleMapsService();