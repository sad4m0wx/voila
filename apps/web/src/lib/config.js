// Map configuration
export const defaultMapCenter = [2.3522, 48.8566]; // Paris coordinates [longitude, latitude]
export const defaultMapZoom = 12;

// Debug mode - only enabled on localhost
export const isDebugMode = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || 
   window.location.hostname === '127.0.0.1' || 
   window.location.hostname === '0.0.0.0');

// Google Maps configuration
export const googleMapsConfig = {
  apiKey: null, // Will be set from environment variables
  libraries: ['places', 'geometry']
};