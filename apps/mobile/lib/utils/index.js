export * from './platform';
export * from './phoneUtils';

/**
 * Check if coordinates are within Île-de-France region
 * @param {Object} coordinates - Object containing lat and lng
 * @returns {boolean} - True if coordinates are within bounds
 */
export const isInIleDeFrance = (coordinates) => {
  // Île-de-France approximate bounding box
  const IDF_BOUNDS = {
    southwest: { lat: 48.1201, lng: 1.4462 },
    northeast: { lat: 49.2412, lng: 3.5590 }
  };

  return coordinates &&
    coordinates.lat >= IDF_BOUNDS.southwest.lat &&
    coordinates.lat <= IDF_BOUNDS.northeast.lat &&
    coordinates.lng >= IDF_BOUNDS.southwest.lng &&
    coordinates.lng <= IDF_BOUNDS.northeast.lng;
}; 