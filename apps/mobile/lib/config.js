// Map configuration  
export const defaultMapCenter = [2.3522, 48.8566]; // Paris coordinates [longitude, latitude]
export const defaultMapZoom = 12;

// Debug mode - enabled in development
export const isDebugMode = __DEV__;

// API Configuration
export const CORE_API_URL = process.env.EXPO_PUBLIC_CORE_API_URL || 'http://localhost:3001';

// Google Maps configuration
export const googleMapsConfig = {
  apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_GEOCODE_API_KEY || null,
  libraries: ['places', 'geometry']
};

// Firebase configuration
export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

// Environment helper
export const getEnvironment = () => {
  return {
    isDevelopment: __DEV__,
    isProduction: !__DEV__,
    coreApiUrl: CORE_API_URL,
    googleMapsApiKey: googleMapsConfig.apiKey,
    firebaseConfig
  };
}; 