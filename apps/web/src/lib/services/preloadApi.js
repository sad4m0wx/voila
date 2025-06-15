// Preload API for isochrone caching
const CORE_API_URL = import.meta.env.VITE_CORE_API_URL || '';

/**
 * Preload isochrone for a location to warm the cache
 * @param {Object} location - Location object with lat/lng
 * @param {Array<number>} timeLimits - Array of time limits in minutes (default: [20, 25, 30, 35, 40])
 * @param {string} profile - Transport profile (default: "pt")
 * @returns {Promise<Object>} Response object
 */
export async function preloadIsochrone(location, timeLimits = [20, 25, 30, 35, 40], profile = "pt") {

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
        time_limits: timeLimits,
        profile: profile
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Preload API Error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ ${result.message}`);
    } else {
      console.warn('⚠️ Preload failed:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Preload request failed:', error);
    return {
      success: false,
      message: error.message,
      error: error.message
    };
  }
}

export async function preloadIsochroneForAddress(location) {
  return await preloadIsochrone(location);
} 