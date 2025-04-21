// Re-export all web-specific components and services
export { GoogleMapsService, googleMapsService } from './GoogleMapsService';
export { isGoogleMapsLoaded, loadGoogleMapsScript, waitForGoogleMaps } from './GoogleMapsLoader';

// Export components
export { default as MapContainer } from './components/MapContainer.svelte';
export { default as AddressInput } from './components/AddressInput.svelte';
export { default as MapProvider } from './components/MapProvider.svelte';