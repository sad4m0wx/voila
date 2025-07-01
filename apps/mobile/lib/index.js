// Re-export everything from existing modules
export * from './components/core';
export * from './components/maps';
export * from './components/meeting';
export * from './components/utils';

// Auth exports
export * from './contexts/AuthContext';
export * from './components/auth';

// Utils exports
export * from './utils/phoneUtils';

// Services
export { findOptimalMeetingPoint } from './services/meetingPointApi';
export { googleMapsService } from './services/map';

// Configuration
export { 
  defaultMapCenter, 
  defaultMapZoom,
  googleMapsConfig 
} from './config';

// Components
export { LoadingIndicator } from './components/utils';
export { MetroBackground } from './components/core';
export { AddressInput, MapContainer } from './components/maps';
export { AddressForm, MeetingPointDisplay } from './components/meeting'; 