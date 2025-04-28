let mapsLoadState = {
    isLoading: false,
    isLoaded: false,
    loadPromise: null
};

/**
 * Check if Google Maps is loaded
 * This function checks both the local state and window.google.maps
 */
export function isGoogleMapsLoaded() {
    // First check if our load state says it's loaded
    if (mapsLoadState.isLoaded) {
        return true;
    }

    // Double-check window.google.maps directly as a fallback
    if (typeof window !== 'undefined' && window.google && window.google.maps) {
        // Update our state since Maps is loaded
        mapsLoadState.isLoaded = true;
        return true;
    }

    return false;
}

/**
 * Load Google Maps Script dynamically
 * Uses a singleton pattern to prevent multiple loads
 * @param {string} [apiKey] - Optional Google Maps API key
 * @returns {Promise<any>} - Promise resolving to window.google
 */
export function loadGoogleMapsScript(apiKey = null) {
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
        window[callbackName] = function () {
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
            const script = document.createElement('script');

            // Construct URL with or without API key
            const url = new URL('https://maps.googleapis.com/maps/api/js');
            url.searchParams.append('libraries', 'places');
            url.searchParams.append('callback', callbackName);

            if (apiKey) {
                url.searchParams.append('key', apiKey);
            }

            script.src = url.toString();
            script.async = true;
            script.defer = true;

            // Handle script load errors
            script.onerror = (error) => {
                clearTimeout(loadTimeout);
                mapsLoadState.isLoading = false;
                delete window[callbackName];
                reject(new Error('Failed to load Google Maps script: ' + (error?.message || 'Unknown error')));
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
 * Reset the loader state (primarily for testing)
 * @private
 */
export function _resetLoaderState() {
    mapsLoadState = {
        isLoading: false,
        isLoaded: false,
        loadPromise: null
    };
}