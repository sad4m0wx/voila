// Preload API for isochrone caching
const CORE_API_URL = import.meta.env.VITE_CORE_API_URL || '';

/**
 * Preload isochrone for a location to warm the cache
 * @param {Object} location - Location object with lat/lng
 * @param {number} timeLimit - Time limit in minutes (default: 30, always overruled as a vector of time limits if default)
 * @param {string} profile - Transport profile (default: "pt")
 * @returns {Promise<Object>} Response object
 */
export async function preloadIsochrone(location, timeLimit = 30, profile = "pt") {
  console.log(`🎯 Preloading isochrone for (${location.lat}, ${location.lng}) - ${timeLimit}min ${profile}`);
  
  try {
    const response = await fetch(`${CORE_API_URL}/api/preload/isochrone`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        location: {
          latitude: location.lat,
          longitude: location.lng
        },
        time_limit: timeLimit,
        profile: profile
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Preload API Error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      if (result.cached && result.cached.length > 0) {
        console.log(`✅ Already cached: ${result.cached.join(', ')}min`);
      }
      if (result.computed && result.computed.length > 0) {
        console.log(`🚀 Precomputed: ${result.computed.join(', ')}min`);
      }
      console.log(`📊 ${result.message}`);
    } else {
      console.warn('⚠️ Preload failed:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Preload request failed:', error);
    // Don't throw - preloading is optional
    return {
      success: false,
      cached: [],
      computed: [],
      message: error.message,
      error: error.message
    };
  }
}


/**
 * Preload isochrone for an address selection event
 */
export async function preloadForAddress(location) {
  // Preload with default 30-minute public transport isochrone, but always overruled as a vector of time limits
  return await preloadIsochrone(location, 30, "pt");
} 