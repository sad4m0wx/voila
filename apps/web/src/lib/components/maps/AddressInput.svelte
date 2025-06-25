<script>
    import { onMount, createEventDispatcher } from 'svelte';
    import { googleMapsService } from '../../services/map/GoogleMapsService';
    import { preloadIsochroneForAddress } from '../../services/preloadApi.js';
    
    // Props
    export let value = '';
    export let placeholder = 'Enter an address';
    export let disabled = false;
    export let bounds = null;
    export let enablePreload = true; 
    
    // Internal state
    let inputElement;
    let autocomplete = null;
    let isInitialized = false;
    let isFocused = false;
    let isLoading = false;
    
    const dispatch = createEventDispatcher();
    
    onMount(async () => {
      try {
        isLoading = true;
        // Initialize Google Maps
        await googleMapsService.initialize();
        
        // Wait for next tick to ensure input is mounted
        setTimeout(initAutocomplete, 0);
      } catch (error) {
        console.error('Error initializing address input:', error);
        dispatch('error', { error: error.message });
      } finally {
        isLoading = false;
      }
    });
    
    function initAutocomplete() {
      if (!window.google || !window.google.maps || !window.google.maps.places || !inputElement) {
        console.warn('Google Maps Places API not available or input not ready');
        return;
      }
      
      // Create the autocomplete object
      autocomplete = new window.google.maps.places.Autocomplete(inputElement, {
        types: ['address'],
        fields: ['formatted_address', 'geometry', 'place_id', 'name']
      });
      
      // Apply bounds if provided
      if (bounds) {
        updateBounds();
      }
      
      // Add place_changed listener
      autocomplete.addListener('place_changed', handlePlaceChanged);
      
      isInitialized = true;
    }
    
    async function handlePlaceChanged() {
      const place = autocomplete.getPlace();
      
      if (!place.geometry) {
        console.warn('No geometry found for the selected place');
        return;
      }
      
      // Get address components and location
      const address = place.formatted_address || '';
      const location = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng()
      };
      
      // Dispatch event with the selected place
      dispatch('place-selected', {
        address,
        location,
        placeId: place.place_id
      });
      
      // Update the input value
      value = address;
      
      // Trigger preload if enabled
      if (enablePreload) {
        preloadIsochroneForAddress(location).catch(error => {
          console.warn('Preload failed (non-critical):', error);
        });
      }
    }
    
    // Update bounds when the bounds prop changes
    $: if (autocomplete && bounds) {
      updateBounds();
    }
    
    function updateBounds() {
      if (!autocomplete || !bounds) return;
      
      const googleBounds = new window.google.maps.LatLngBounds(
        new window.google.maps.LatLng(bounds.southwest[1], bounds.southwest[0]),
        new window.google.maps.LatLng(bounds.northeast[1], bounds.northeast[0])
      );
      
      autocomplete.setBounds(googleBounds);
    }
    
    // Handle input changes
    function handleInput(event) {
      value = event.target.value;
      dispatch('input', { value });
    }
    
    function handleFocus() {
      isFocused = true;
    }
    
    function handleBlur() {
      isFocused = false;
    }
  </script>
  
  <div class="address-input-container">
    <div class="relative">
      <!-- Location Icon -->
      <div class="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary-400 pointer-events-none">
        {#if isLoading}
          <div class="loader loader-sm"></div>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        {/if}
      </div>
      
      <!-- Input Field -->
      <input
        type="text"
        bind:this={inputElement}
        {value}
        {placeholder}
        {disabled}
        on:input={handleInput}
        on:focus={handleFocus}
        on:blur={handleBlur}
        class="input pl-11 pr-4 {isFocused ? 'ring-2 ring-primary-500 border-transparent' : ''} {disabled ? 'opacity-50 cursor-not-allowed' : ''}"
        style="font-size: 16px;" 
        autocomplete="address-line1"
      />
      
      <!-- Clear Button -->
      {#if value && !disabled}
        <button
          type="button"
          class="absolute right-3 top-1/2 transform -translate-y-1/2 text-secondary-400 hover:text-secondary-600 transition-colors"
          on:click={() => { value = ''; dispatch('input', { value: '' }); }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      {/if}
    </div>
    

  </div>