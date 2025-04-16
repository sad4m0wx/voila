// src/lib/services/googleMapsProxy.js

// Maintain load state
let mapsLoadState = {
  isLoading: false,
  isLoaded: false,
  loadPromise: null
};

/**
 * Check if Google Maps is loaded
 * This function will be more reliable now
 */
export function isGoogleMapsLoaded() {
  // First check if our load state says it's loaded
  if (mapsLoadState.isLoaded) {
    return true;
  }
  
  // Double-check window.google.maps directly as a fallback
  if (window && window.google && window.google.maps) {
    // Update our state since Maps is loaded
    mapsLoadState.isLoaded = true;
    return true;
  }
  
  return false;
}

/**
 * Load Google Maps Script dynamically
 * Uses a singleton pattern to prevent multiple loads
 * Improved with better error handling and state tracking
 */
export function loadGoogleMapsScript() {
  // If already loaded, return resolved promise
  if (isGoogleMapsLoaded()) {
    return Promise.resolve(window.google);
  }
  
  // If currently loading, return the existing promise
  if (mapsLoadState.isLoading && mapsLoadState.loadPromise) {
    return mapsLoadState.loadPromise;
  }
  
  // Create a new loading promise
  mapsLoadState.isLoading = true;
  mapsLoadState.loadPromise = new Promise((resolve, reject) => {
    // Define a unique callback name to avoid conflicts
    const callbackName = 'googleMapsCallback_' + Date.now().toString(36);
    
    // Set timeout to detect loading failures
    const loadTimeout = setTimeout(() => {
      if (!isGoogleMapsLoaded()) {
        delete window[callbackName];
        reject(new Error('Google Maps loading timed out after 20 seconds'));
      }
    }, 20000);
    
    // Create the callback function
    window[callbackName] = function() {
      clearTimeout(loadTimeout);
      
      // Set a slight delay to ensure Maps is fully initialized
      setTimeout(() => {
        mapsLoadState.isLoaded = true;
        mapsLoadState.isLoading = false;
        resolve(window.google);
        delete window[callbackName];
      }, 100);
    };
    
    try {
      // Create the script element
      // Using no API key - the script will still load the client library without a key
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?libraries=places&callback=${callbackName}`;
      script.async = true;
      script.defer = true;
      
      // Handle script load errors
      script.onerror = (error) => {
        clearTimeout(loadTimeout);
        mapsLoadState.isLoading = false;
        delete window[callbackName];
        reject(new Error('Failed to load Google Maps script: ' + error.message));
      };
      
      // Append script to the document
      document.head.appendChild(script);
      
      console.log('Google Maps script added to document head');
    } catch (error) {
      clearTimeout(loadTimeout);
      mapsLoadState.isLoading = false;
      delete window[callbackName];
      reject(error);
    }
  });
  
  // Add error handling for the promise
  mapsLoadState.loadPromise.catch(error => {
    console.error('Error loading Google Maps:', error);
    mapsLoadState.isLoading = false;
    mapsLoadState.loadPromise = null;
  });
  
  return mapsLoadState.loadPromise;
}

/**
 * Wait for Google Maps to be available
 * This is useful for components that need to ensure Maps is ready
 */
export async function waitForGoogleMaps(timeoutMs = 10000) {
  // If already loaded, return immediately
  if (isGoogleMapsLoaded()) {
    return window.google;
  }
  
  // If we're in the process of loading, wait for the promise to resolve
  if (mapsLoadState.isLoading && mapsLoadState.loadPromise) {
    return mapsLoadState.loadPromise;
  }
  
  // Otherwise, start loading and wait
  const loadPromise = loadGoogleMapsScript();
  
  // Create a timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Timeout waiting for Google Maps')), timeoutMs);
  });
  
  // Race the load against the timeout
  return Promise.race([loadPromise, timeoutPromise]);
}

/**
 * Geocode an address to coordinates via server proxy
 */
export async function geocodeAddress(address) {
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
    
    return await response.json();
  } catch (error) {
    console.error('Geocoding error:', error);
    throw error;
  }
}

/**
 * Get directions between two points via server proxy
 */
export async function getDirections(origin, destination, mode = 'transit') {
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
 * Find nearby places via server proxy
 */
export async function findNearbyPlaces(location, type = 'restaurant', radius = 500) {
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

// Extract transit information from directions
export function extractTransitInfo(directions) {
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
    const icon = getTransitIcon(tl.type);
    return `${icon} ${tl.line} (${tl.from} → ${tl.to})`;
  }).join(', ');
  
  return {
    transitLines,
    transitSummary
  };
}

/**
 * Get an icon/emoji for a transit type
 */
function getTransitIcon(type) {
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