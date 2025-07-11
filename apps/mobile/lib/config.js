import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Map configuration  
export const defaultMapCenter = [2.3522, 48.8566]; // Paris coordinates [longitude, latitude]
export const defaultMapZoom = 12;

// Debug mode - enabled in development
export const isDebugMode = __DEV__;

// API Configuration
export const CORE_API_URL = process.env.EXPO_PUBLIC_CORE_API_URL || 'http://localhost:3001';
// Supabase configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// API configuration
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';

// Google Maps configuration
export const googleMapsConfig = {
  apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_GEOCODE_API_KEY || null,
  libraries: ['places', 'geometry']
};

// Environment helper
export const getEnvironment = () => {
  return {
    isDevelopment: __DEV__,
    isProduction: !__DEV__,
    coreApiUrl: API_BASE_URL,
    googleMapsApiKey: googleMapsConfig.apiKey
  };
};

// Map height constants
export const MAP_HEIGHTS = {
  DEFAULT: 320,
  EXPANDED: 400,
  WITH_RESULTS: 280,
  WITH_RESULTS_EXPANDED: 360,
  GROUP_DEFAULT: 280,
  GROUP_EXPANDED: 360
};

export default {
  supabase,
  API_BASE_URL,
  supabaseUrl,
  supabaseAnonKey,
}; 