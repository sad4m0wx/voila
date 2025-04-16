<!-- src/lib/components/MobileAddressInput.svelte -->
<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { isGoogleMapsLoaded, waitForGoogleMaps } from '$lib/services/googleMapsProxy';
  
  // Props
  export let value = '';
  export let onUpdate = () => {};
  export let onRemove = () => {};
  export let placeholder = 'Enter an address';
  export let mapBounds = null; // Optional: current map bounds to prioritize results
  
  // Internal state
  let inputElement;
  let autocomplete;
  let isFocused = false;
  let isLoading = true;
  let errorMessage = '';
  
  const dispatch = createEventDispatcher();
  
  onMount(async () => {
    try {
      // Wait for Google Maps to load with a timeout
      await waitForGoogleMaps(10000);
      
      // Now initialize the autocomplete
      if (isGoogleMapsLoaded()) {
        initAutocomplete();
        isLoading = false;
      } else {
        errorMessage = 'Address search unavailable. Maps could not load.';
        isLoading = false;
      }
    } catch (error) {
      console.error('Error loading Google Maps for address input:', error);
      errorMessage = 'Address search unavailable: ' + error.message;
      isLoading = false;
    }
  });
  
  onDestroy(() => {
    // Clean up event listeners if necessary
    if (autocomplete && window.google && window.google.maps) {
      google.maps.event.clearInstanceListeners(autocomplete);
    }
  });
  
  // Watch for changes to map bounds
  $: if (autocomplete && mapBounds) {
    updateAutocompleteOptions();
  }
  
  // Initialize Google Places Autocomplete
  function initAutocomplete() {
    try {
      if (!window.google || !window.google.maps || !window.google.maps.places) {
        throw new Error('Google Maps Places API not loaded');
      }
      
      // Initialize autocomplete on the input element
      autocomplete = new google.maps.places.Autocomplete(inputElement, {
        types: ['address'],
        fields: ['formatted_address', 'geometry', 'name', 'place_id']
      });
      
      // Set bounds if available
      if (mapBounds) {
        updateAutocompleteOptions();
      }
      
      // Add listener for place changes
      autocomplete.addListener('place_changed', handlePlaceChanged);
      
      console.log('Address autocomplete initialized successfully');
    } catch (error) {
      console.error('Error initializing autocomplete:', error);
      errorMessage = 'Could not enable address search';
    }
  }
  
  // Update autocomplete options when map bounds change
  function updateAutocompleteOptions() {
    if (!autocomplete || !mapBounds) return;
    
    try {
      // Convert our bounds object to Google Maps LatLngBounds
      const bounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(mapBounds.south, mapBounds.west),
        new google.maps.LatLng(mapBounds.north, mapBounds.east)
      );
      
      // Set bounds to prioritize results in the current map view
      autocomplete.setBounds(bounds);
      
      // Still allow results outside of bounds, but prioritize those inside
      autocomplete.setOptions({ strictBounds: false });
    } catch (error) {
      console.error('Error updating autocomplete bounds:', error);
    }
  }
  
  // Handle when a place is selected from the autocomplete
  function handlePlaceChanged() {
    try {
      const place = autocomplete.getPlace();
      
      if (!place.geometry) {
        // User pressed enter without selecting from dropdown
        return;
      }
      
      // Update the value with the selected address
      value = place.formatted_address || place.name;
      onUpdate(value);
      
      // Dispatch the selected place for potential additional use
      dispatch('place-selected', {
        address: value,
        location: {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        },
        placeId: place.place_id
      });
    } catch (error) {
      console.error('Error handling place selection:', error);
    }
  }
  
  // Handle manual input
  function handleInput(e) {
    value = e.target.value;
    onUpdate(value);
  }
  
  function handleFocus() {
    isFocused = true;
  }
  
  function handleBlur() {
    isFocused = false;
  }
  
  // Use current location
  async function useCurrentLocation() {
    if (!navigator.geolocation) {
      errorMessage = "Geolocation is not supported by your browser";
      return;
    }
    
    try {
      isLoading = true;
      
      // Get current position
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });
      
      const coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      
      // Check if Google Maps is available for reverse geocoding
      if (!isGoogleMapsLoaded()) {
        // If Google Maps isn't available, we can at least use the coordinates
        value = `Location: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
        onUpdate(value);
        
        // Dispatch with the coordinates
        dispatch('place-selected', {
          address: value,
          location: coords
        });
        return;
      }
      
      // Reverse geocode to get address
      const geocoder = new google.maps.Geocoder();
      
      const result = await new Promise((resolve, reject) => {
        geocoder.geocode({ location: coords }, (results, status) => {
          if (status === 'OK' && results[0]) {
            resolve(results[0]);
          } else {
            reject(new Error(`Geocoding failed: ${status}`));
          }
        });
      });
      
      // Update the value with the selected address
      value = result.formatted_address;
      onUpdate(value);
      
      // Dispatch the selected place
      dispatch('place-selected', {
        address: value,
        location: coords,
        placeId: result.place_id
      });
      
    } catch (error) {
      console.error('Error getting current location:', error);
      errorMessage = 'Unable to get your current location';
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="address-input {isFocused ? 'is-focused' : ''} {errorMessage ? 'has-error' : ''}">
  <div class="input-group">
    <div class="input-wrapper">
      <svg xmlns="http://www.w3.org/2000/svg" class="input-icon location-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3"></circle>
      </svg>
      
      <input
        type="text"
        class="input"
        {placeholder}
        bind:this={inputElement}
        bind:value
        on:input={handleInput}
        on:focus={handleFocus}
        on:blur={handleBlur}
        disabled={isLoading}
      />
      
      {#if isLoading}
        <div class="input-action loading">
          <div class="loader loader-sm"></div>
        </div>
      {:else if value}
        <button 
          class="input-action clear"
          type="button"
          on:click={() => { value = ''; onUpdate(''); }}
          title="Clear address"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      {/if}
    </div>
    
    <div class="action-buttons">
      <button 
        class="btn btn-outline btn-icon"
        type="button"
        on:click={useCurrentLocation}
        title="Use my current location"
        disabled={isLoading}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="22" y1="12" x2="18" y2="12"></line>
          <line x1="6" y1="12" x2="2" y2="12"></line>
          <line x1="12" y1="6" x2="12" y2="2"></line>
          <line x1="12" y1="22" x2="12" y2="18"></line>
        </svg>
      </button>
      
      <button 
        class="btn btn-outline btn-icon remove-button"
        type="button"
        on:click={onRemove} 
        title="Remove address"
        disabled={isLoading}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18"></path>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </div>
  </div>
  
  {#if errorMessage}
    <div class="error-message">
      <svg xmlns="http://www.w3.org/2000/svg" class="error-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      {errorMessage}
    </div>
  {/if}
</div>

<style>
  .address-input {
    width: 100%;
    margin-bottom: var(--space-2);
  }
  
  .input-group {
    display: flex;
    gap: var(--space-2);
    width: 100%;
    position: relative;
  }
  
  .input-wrapper {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
    border: 1px solid var(--neutral-300);
    border-radius: var(--radius-md);
    background-color: white;
    transition: all var(--transition-fast);
  }
  
  .is-focused .input-wrapper {
    border-color: var(--primary-500);
    box-shadow: var(--shadow-focus);
  }
  
  .has-error .input-wrapper {
    border-color: var(--error);
  }
  
  .input-icon {
    position: absolute;
    left: var(--space-3);
    color: var(--neutral-500);
    width: var(--space-4);
    height: var(--space-4);
    pointer-events: none;
    z-index: 1;
  }
  
  .is-focused .input-icon {
    color: var(--primary-500);
  }
  
  .input {
    flex: 1;
    padding: var(--space-3) var(--space-3) var(--space-3) var(--space-8);
    border: none;
    outline: none;
    background: transparent;
    font-size: var(--text-base);
    width: 100%;
    color: var(--text-primary);
    border-radius: var(--radius-md);
  }
  
  .input:disabled {
    background-color: var(--neutral-100);
    cursor: not-allowed;
  }
  
  .input-action {
    position: absolute;
    right: var(--space-3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--neutral-500);
  }
  
  .input-action.clear {
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--space-1);
    border-radius: var(--radius-full);
    color: var(--neutral-500);
    transition: all var(--transition-fast);
  }
  
  .input-action.clear:hover {
    background-color: var(--neutral-100);
    color: var(--neutral-700);
  }
  
  .action-buttons {
    display: flex;
    gap: var(--space-2);
  }
  
  .btn-icon {
    width: 42px;
    height: 42px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--neutral-700);
  }
  
  .remove-button:hover {
    color: var(--error);
    border-color: var(--error);
    background-color: rgba(239, 68, 68, 0.1);
  }
  
  .error-message {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    margin-top: var(--space-1);
    color: var(--error);
    font-size: var(--text-xs);
    padding-left: var(--space-1);
  }
  
  .error-icon {
    flex-shrink: 0;
  }
  
  /* Google Places Autocomplete custom styling */
  :global(.pac-container) {
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--neutral-200);
    font-family: inherit;
    margin-top: var(--space-1);
    z-index: 1050 !important;
  }
  
  :global(.pac-item) {
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }
  
  :global(.pac-item:hover) {
    background-color: var(--primary-50);
  }
  
  :global(.pac-item-selected) {
    background-color: var(--primary-100);
  }
  
  :global(.pac-icon) {
    margin-right: var(--space-2);
  }
  
  :global(.pac-item-query) {
    font-size: var(--text-sm);
  }
  
  :global(.pac-matched) {
    font-weight: var(--font-semibold);
    color: var(--primary-700);
  }
  
  @media (max-width: 768px) {
    .input-group {
      flex-wrap: wrap;
    }
    
    .input-wrapper {
      flex-basis: 100%;
    }
    
    .action-buttons {
      margin-top: var(--space-2);
      width: 100%;
    }
    
    .btn-icon {
      flex: 1;
    }
    
    :global(.pac-container) {
      width: calc(100% - 2rem) !important;
      left: 1rem !important;
    }
  }
</style>