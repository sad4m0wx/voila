<!-- src/lib/components/SecureGoogleMapsProvider.svelte -->
<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { loadGoogleMapsScript, isGoogleMapsLoaded } from '$lib/services/googleMapsLoader';
  
  // Get the API key from environment variables
  const MAPS_BROWSER_KEY = import.meta.env.VITE_MAPS_BROWSER_KEY;
  
  // States
  let isLoading = true;
  let error = null;
  let mapsReady = false;
  
  const dispatch = createEventDispatcher();
  
  onMount(async () => {
    // If already loaded, dispatch ready immediately
    if (isGoogleMapsLoaded()) {
      mapsReady = true;
      isLoading = false;
      dispatch('ready', { google: window.google });
      return;
    }
    
    if (!MAPS_BROWSER_KEY) {
      // Key not defined in environment variables
      error = 'Maps API key is missing. Please check your environment variables.';
      isLoading = false;
      dispatch('error', { message: error });
      return;
    }
    
    try {
      // Load Google Maps with the restricted key
      await loadGoogleMapsScript(MAPS_BROWSER_KEY);
      mapsReady = true;
      dispatch('ready', { google: window.google });
    } catch (err) {
      console.error('Failed to load Google Maps:', err);
      error = 'Could not load Google Maps. Please refresh the page.';
      dispatch('error', { message: error });
    } finally {
      isLoading = false;
    }
  });
</script>

{#if isLoading}
  <div class="maps-loading">
    <slot name="loading">
      <div class="loader-container">
        <div class="loader"></div>
        <p>Loading maps...</p>
      </div>
    </slot>
  </div>
{:else if error}
  <div class="maps-error">
    <slot name="error" {error}>
      <div class="error-container">
        <p>{error}</p>
        <button on:click={() => window.location.reload()}>
          Reload Page
        </button>
      </div>
    </slot>
  </div>
{:else}
  <slot {mapsReady}></slot>
{/if}

<style>
  .maps-loading,
  .maps-error {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #f8f9fa;
    border-radius: 8px;
  }
  
  .loader-container,
  .error-container {
    text-align: center;
    padding: 2rem;
  }
  
  .loader {
    width: 2.5rem;
    height: 2.5rem;
    border: 3px solid #e0e0e0;
    border-top-color: #4a80f5;
    border-radius: 50%;
    margin: 0 auto 1rem;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  
  .error-container p {
    color: #d32f2f;
    margin-bottom: 1rem;
  }
  
  .error-container button {
    background-color: #4a80f5;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .error-container button:hover {
    background-color: #3a70e5;
  }
</style>