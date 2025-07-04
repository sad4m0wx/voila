import { useEffect, useRef } from 'react';
import { preloadIsochrone } from '../services/preloadApi';
import { useAuth } from '../contexts/AuthContext';

/**
 * Custom hook to handle app initialization tasks
 * This runs when the app starts up and preloads isochrones for user addresses
 * Only runs once per app session to avoid spamming the API
 */
export const useAppInitialization = () => {
  const { user, addresses } = useAuth();
  const hasPreloaded = useRef(false); // Track if we've already preloaded

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 Initializing app...');
        
        if (hasPreloaded.current) {
          return;
        }
        
        if (user && addresses && addresses.length > 0) {
          console.log(`📍 Preloading isochrones for ${addresses.length} user addresses`);
          
          // Preload isochrones for each user address
          const preloadPromises = addresses.map(async (address) => {
            try {
              const location = {
                lat: address.latitude,
                lng: address.longitude
              };
              
              await preloadIsochrone(location);
            } catch (error) {
              console.warn(`⚠️ Failed to preload isochrone for ${address.name}:`, error.message);
            }
          });

          // Run preload requests in background (don't wait for completion)
          Promise.allSettled(preloadPromises);
          
          // Mark preloading as complete
          hasPreloaded.current = true;
        }
        
        console.log('✅ App initialization completed successfully');
      } catch (error) {
        console.warn('⚠️ App initialization warning (non-critical):', error.message);
      }
    };

    initializeApp();
  }, [user, addresses]);
}; 