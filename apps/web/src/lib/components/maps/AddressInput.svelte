<script>
    import { onMount, createEventDispatcher } from 'svelte';
    import { googleMapsService } from '../../services/map/GoogleMapsService';
    
    // Props
    export let value = '';
    export let placeholder = 'Enter an address';
    export let disabled = false;
    export let bounds = null;
    
    // Internal state
    let inputElement;
    let autocomplete = null;
    let isInitialized = false;
    
    const dispatch = createEventDispatcher();
    
    onMount(async () => {
      try {
        // Initialize Google Maps
        await googleMapsService.initialize();
        
        // Wait for next tick to ensure input is mounted
        setTimeout(initAutocomplete, 0);
      } catch (error) {
        console.error('Error initializing address input:', error);
        dispatch('error', { error: error.message });
      }
    });
    
    function initAutocomplete() {
      if (!window.google || !window.google.maps || !window.google.maps.places || !inputElement) {
        console.warn('Google Maps Places API not available or input not ready');
        return;
      }
      
      // Create the autocomplete object
      autocomplete = new window.google.maps.places.Autocomplete(inputElement, {
        types: ['address']
      });
      
      // Apply bounds if provided
      if (bounds) {
        updateBounds();
      }
      
      // Add place_changed listener
      autocomplete.addListener('place_changed', handlePlaceChanged);
      
      isInitialized = true;
    }
    
    function handlePlaceChanged() {
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
  </script>
  
  <div class="address-input-container">
    <input
      type="text"
      bind:this={inputElement}
      {value}
      {placeholder}
      {disabled}
      on:input={handleInput}
      on:focus
      on:blur
      class="address-input"
    />
  </div>
  
  <style>
    .address-input-container {
      position: relative;
      width: 100%;
    }
    
    .address-input {
      width: 100%;
      padding: 8px 12px;
      font-size: 16px;
      border: 1px solid #ccc;
      border-radius: 4px;
    }
    
    .address-input:focus {
      outline: none;
      border-color: #1a73e8;
      box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.2);
    }
  </style>