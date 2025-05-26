<script>
  import { onMount } from "svelte";
  import MapProvider from '$components/maps/MapProvider.svelte';
  import MapContainer from '$components/maps/MapContainer.svelte';
  import { findOptimalMeetingPoint } from "$services/meetingPointApi";
  import { defaultMapCenter, defaultMapZoom } from "$lib/config.js";
  import MobileHeader from "$components/core/MobileHeader.svelte";
  import AddressForm from "$components/meeting/AddressForm.svelte";
  import MeetingPointResults from "$components/meeting/MeetingPointResults.svelte";
  import VenueOptions from "$components/venues/VenueOptions.svelte";
  
  // State
  let addresses = [{ id: 1, value: '', coordinates: null }, { id: 2, value: '', coordinates: null }];
  let nextId = 3;
  let meetingPoint = null;
  let routes = [];
  let venues = [];
  let isCalculating = false;
  let error = null;
  let mapBounds = null;
  let showResults = false;
  
  // Venue options
  let showVenues = true;
  let venueTypes = ["restaurant"];
  let venueRadius = 500; // 500 meters radius
  
  // Check if we're on mobile
  $: isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  $: mapHeight = isMobile ? 'calc(40vh)' : '500px';
  
  // Add a state variable to track when to animate to results
  let animateToResults = false;
  
  function addAddress() {
    addresses = [...addresses, { id: nextId, value: '', coordinates: null }];
    nextId += 1;
  }
  
  function removeAddress(id) {
    if (addresses.length <= 2) {
      error = "You need at least two addresses";
      return;
    }
    addresses = addresses.filter(addr => addr.id !== id);
    error = null;
  }
  
  function updateAddress(id, value) {
    addresses = addresses.map(addr => 
      addr.id === id ? { ...addr, value, coordinates: null } : addr
    );
  }
  
  function updateAddressWithCoordinates(id, value, coordinates) {
    addresses = addresses.map(addr => 
      addr.id === id ? { ...addr, value, coordinates } : addr
    );
  }
  
  // Handle venue type selection change
  function handleVenueTypeChange(event) {
    venueTypes = event.detail.selectedTypes;
  }
  
  // Handle venue selection
  function handleVenueSelected(event) {
    const venue = event.detail.venue;
    
    // Center map on the venue
    if (venue?.location) {
      const mapElement = document.querySelector(".map-container");
      if (mapElement) {
        mapElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }
  
  async function findMeetingPoint() {
    // Reset state
    error = null;
    isCalculating = true;
    showResults = false;
    venues = [];
    animateToResults = false; // Reset animation flag
    
    try {
      // Validate inputs
      if (addresses.some(addr => !addr.value.trim())) {
        throw new Error("All addresses must be filled");
      }
      
      if (!isGoogleMapsLoaded()) {
        throw new Error("Map is not ready yet. Please wait a moment and try again.");
      }
      
      // Calculate meeting point with venue options
      const result = await findOptimalMeetingPoint(addresses, {
        venueTypes: showVenues ? venueTypes : null,
        venueRadius: venueRadius,
        showVenues: showVenues
      });
      
      // Update state with result
      meetingPoint = {
        name: result.name,
        coordinates: result.coordinates,
        travelTimes: result.travelTimes
      };
      
      routes = result.routes || [];
      venues = result.venues || [];
      
      // Trigger animation to results
      animateToResults = true;
      
      // Show results on mobile
      if (isMobile) {
        setTimeout(() => {
          showResults = true;
          isCalculating = false; // Only set calculating to false after results are shown
        }, 1000); // Increased to allow animation to complete
      } else {
        isCalculating = false;
      }
      
    } catch (err) {
      console.error("Error finding meeting point:", err);
      error = err.message || "Failed to calculate meeting point. Please try again.";
      isCalculating = false;
    }
  }
  
  function handlePlaceSelected(event, addressId) {
    const { address, location } = event.detail;
    const coordinates = [location.lng, location.lat]; // Convert to [longitude, latitude]
    updateAddressWithCoordinates(addressId, address, coordinates);
  }
  
  function handleMapBounds(event) {
    mapBounds = event.detail.bounds;
  }
  
  function toggleResults() {
    showResults = !showResults;
  }

  // Create map markers for all locations (addresses, meeting point, venues)
  $: mapMarkers = createMapMarkers(addresses, meetingPoint, venues);

  function createMapMarkers(addresses, meetingPoint, venues) {
    const markers = [];
    
    // Add markers for addresses
    addresses.forEach((address, index) => {
      if (address.coordinates) {
        markers.push({
          position: address.coordinates,
          title: address.value || `Location ${index + 1}`,
          type: 'location',
          number: index + 1
        });
      }
    });
    
    // Add marker for meeting point
    if (meetingPoint && meetingPoint.coordinates) {
      markers.push({
        position: meetingPoint.coordinates,
        title: meetingPoint.name || 'Meeting Point',
        type: 'meeting-point',
        info: `<div class="p-2">
          <h4 class="font-bold">${meetingPoint.name || 'Meeting Point'}</h4>
          <p>Travel times:</p>
          <ul class="mt-1">
            ${meetingPoint.travelTimes ? meetingPoint.travelTimes.map(tt => `
              <li>${tt.address}: ${tt.duration} min</li>
            `).join('') : ''}
          </ul>
        </div>`
      });
    }
    
    // Add markers for venues
    if (venues && venues.length > 0) {
      venues.forEach((venue, i) => {
        if (venue && venue.location) {
          markers.push({
            position: venue.location,
            title: venue.name || `Venue ${i + 1}`,
            type: 'venue',
            info: `<div class="p-2">
              <h4 class="font-bold">${venue.name || `Venue ${i + 1}`}</h4>
              <p>${venue.address || ''}</p>
              ${venue.rating ? `<p>Rating: ${venue.rating} ⭐</p>` : ''}
            </div>`
          });
        }
      });
    }
    
    return markers;
  }

  // Add the venueRadius as a reference for the meeting zone
  $: meetingZoneRadius = meetingPoint && venueRadius ? venueRadius : 0;
</script>

<svelte:head>
  <title>Voilà! | Find the perfect place to meet</title>
</svelte:head>

<div class="bg-gradient-to-b from-primary-50 to-white min-h-screen">
  {#if isMobile}
    <MobileHeader />
    
    <div class="px-4 pt-2">
      <MapProvider>
        <div slot="loading" class="text-center py-10">
          <div class="loader mx-auto mb-4"></div>
          <p class="text-neutral-600">Loading map services...</p>
        </div>
        
        <div slot="error" let:error class="text-center py-10 text-error">
          <p class="text-lg mb-2">{error}</p>
          <p>Please refresh the page to try again.</p>
        </div>

        <!-- Mobile View Layout -->
        {#if !meetingPoint || !showResults || isCalculating}
          <!-- Input Section -->
          <div class="mb-4">
            <div class="card p-4 shadow-sm rounded-lg bg-white">
              {#if error}
                <div class="alert alert-error mb-4 p-2 text-sm rounded-md bg-red-50 text-red-700 border border-red-200">
                  <span>{error}</span>
                </div>
              {/if}
              
              <h2 class="text-lg font-semibold mb-3">Where is everyone?</h2>
              
              <div class="space-y-3 mb-5">
                {#each addresses as address (address.id)}
                  <div class="flex gap-2">
                    <div class="flex-grow">
                      <AddressInput 
                        value={address.value} 
                        placeholder="Enter an address"
                        bounds={mapBounds}
                        on:input={(e) => updateAddress(address.id, e.detail.value)}
                        on:place-selected={(e) => handlePlaceSelected(e, address.id)}
                      />
                    </div>
                    {#if addresses.length > 2}
                      <button 
                        class="btn btn-icon btn-outline" 
                        on:click={() => removeAddress(address.id)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                      </button>
                    {/if}
                  </div>
                {/each}
              </div>
              
              <div class="flex justify-between items-center">
                <button class="btn btn-sm btn-outline" on:click={addAddress}>
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  Add
                </button>
                
                <button 
                  class="btn btn-sm btn-primary" 
                  on:click={findMeetingPoint} 
                  disabled={isCalculating}
                >
                  {#if isCalculating}
                    <span class="loader loader-sm mr-1"></span>
                    <span>Calculating...</span>
                  {:else}
                    <span>📍 Find Meeting Point</span>
                  {/if}
                </button>
              </div>
              
              <!-- Venue options in expandable section -->
              <div class="mt-4 pt-3 border-t border-neutral-200">
                <div class="flex items-center justify-between">
                  <label class="flex items-center">
                    <input type="checkbox" bind:checked={showVenues} class="form-checkbox h-4 w-4 text-primary-600">
                    <span class="ml-2 text-sm">Show venues</span>
                  </label>
                  
                  {#if showVenues}
                    <div class="flex items-center">
                      <span class="text-xs mr-1">{venueRadius}m</span>
                      <input 
                        type="range" 
                        min="100" 
                        max="1000" 
                        step="100" 
                        bind:value={venueRadius}
                        disabled={isCalculating}
                        class="form-range w-20 h-2"
                      />
                    </div>
                  {/if}
                </div>
                
                {#if showVenues}
                  <div class="mt-3">
                    <VenueTypeSelector 
                      bind:selectedTypes={venueTypes} 
                      disabled={isCalculating}
                      on:change={handleVenueTypeChange}
                    />
                  </div>
                {/if}
              </div>
            </div>
          </div>
          
          <!-- Map Container - Mobile Input View -->
          <div class="rounded-lg overflow-hidden shadow-md map-container h-[40vh] mb-4">
            <MapContainer 
              center={meetingPoint ? meetingPoint.coordinates : defaultMapCenter}
              zoom={meetingPoint ? undefined : defaultMapZoom}
              markers={mapMarkers}
              routes={routes}
              meetingZoneRadius={meetingZoneRadius}
              animateToResults={animateToResults}
              zoomToFitMarkers={false}
              height="100%"
              on:bounds={handleMapBounds}
            />
          </div>
        {:else}
          <!-- Results View -->
          <div class="results-view pb-20">
            <!-- Map with results -->
            <div class="rounded-lg overflow-hidden shadow-md map-container h-[40vh] mb-4">
              <MapContainer 
                center={meetingPoint ? meetingPoint.coordinates : defaultMapCenter}
                zoom={meetingPoint ? undefined : defaultMapZoom}
                markers={mapMarkers}
                routes={routes}
                meetingZoneRadius={meetingZoneRadius}
                animateToResults={animateToResults}
                zoomToFitMarkers={false}
                height="100%"
              />
              
              <!-- Floating back button -->
              <button 
                class="absolute top-3 left-3 z-10 bg-white p-2 rounded-full shadow-md"
                on:click={toggleResults}
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
            
            <!-- Meeting Point Card -->
            <div class="card bg-white p-4 rounded-lg shadow-sm mb-4">
              <div class="flex justify-between items-start mb-3">
                <h2 class="text-lg font-semibold">Meeting Point</h2>
                <div class="badge badge-primary text-sm">
                  <span>📍</span>
                  <span class="ml-1">{meetingPoint.name}</span>
                </div>
              </div>
              
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${meetingPoint.coordinates[1]},${meetingPoint.coordinates[0]}`} 
                target="_blank" 
                rel="noopener noreferrer"
                class="flex items-center text-primary-600 hover:text-primary-700 mb-4 text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                Open in Google Maps
              </a>
              
              <h3 class="text-base font-medium mb-2">Travel Times</h3>
              <ul class="space-y-2 mb-2">
                {#each meetingPoint.travelTimes as time}
                  <li class="p-2 bg-bg-subtle rounded-md flex justify-between items-center">
                    <div class="truncate pr-2">
                      <p class="font-medium text-sm truncate">{time.address}</p>
                    </div>
                    <div class="badge badge-accent whitespace-nowrap">
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      <span>{time.duration} min</span>
                    </div>
                  </li>
                {/each}
              </ul>
            </div>
            
            <!-- Venues List -->
            {#if venues && venues.length > 0}
              <div class="mb-4">
                <VenueList 
                  {venues} 
                  loading={isCalculating}
                  on:select={handleVenueSelected}
                />
              </div>
            {:else if showVenues && !isCalculating}
              <div class="card bg-white p-4 rounded-lg shadow-sm mb-4">
                <h3 class="text-base font-medium mb-2">Nearby Venues</h3>
                <div class="p-4 bg-bg-subtle rounded-md text-center text-neutral-500 text-sm">
                  No venues found near this location.
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </MapProvider>
    </div>
    
  {:else}
    <!-- Desktop view stays mostly the same -->
    <div class="container mx-auto px-4 py-12 md:py-20">
      <div class="text-center max-w-3xl mx-auto mb-12">
        <div class="flex justify-center items-center mb-4">
          <span class="text-5xl animate-bounce inline-block mr-3">📍</span>
          <h1 class="text-4xl md:text-5xl font-bold text-primary-700">Voilà!</h1>
        </div>
        <p class="text-xl md:text-2xl text-neutral-700 mb-6">Find the perfect place to meet with your friends.</p>
      </div>
    </div>
    <div class="max-w-4xl mx-auto">
      <MapProvider>
        <div slot="loading" class="text-center py-10">
          <div class="loader mx-auto mb-4"></div>
          <p class="text-neutral-600">Loading map services...</p>
        </div>
        
        <div slot="error" let:error class="text-center py-10 text-error">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p class="text-lg mb-2">{error}</p>
          <p>Please refresh the page to try again.</p>
        </div>
        
        <!-- Address Entry Card -->
        <div class="card p-4 md:p-6 mb-6 shadow-md">
          {#if error}
            <div class="alert alert-error mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="alert-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          {/if}
          
          <div class="space-y-4 mb-6">
            {#each addresses as address (address.id)}
              <div class="flex gap-2">
                <div class="flex-grow">
                  <AddressInput 
                    value={address.value} 
                    placeholder="Enter an address or location"
                    bounds={mapBounds}
                    on:input={(e) => updateAddress(address.id, e.detail.value)}
                    on:place-selected={(e) => handlePlaceSelected(e, address.id)}
                  />
                </div>
                {#if addresses.length > 2}
                  <button 
                    class="btn btn-icon btn-outline" 
                    on:click={() => removeAddress(address.id)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                  </button>
                {/if}
              </div>
            {/each}
          </div>
          
          <!-- Venue options -->
          <div class="mb-4 border-t border-neutral-200 pt-4">
            <label class="flex items-center mb-3">
              <input type="checkbox" bind:checked={showVenues} class="form-checkbox h-4 w-4 text-primary-600">
              <span class="ml-2 text-neutral-700">Show recommended venues</span>
            </label>
            
            {#if showVenues}
              <div class="space-y-3">
                <VenueTypeSelector 
                  bind:selectedTypes={venueTypes} 
                  disabled={isCalculating}
                  on:change={handleVenueTypeChange}
                />
                
                <div>
                  <label class="block text-sm text-neutral-700 mb-1">Search radius: {venueRadius}m</label>
                  <input 
                    type="range" 
                    min="100" 
                    max="1000" 
                    step="100" 
                    bind:value={venueRadius}
                    disabled={isCalculating}
                    class="form-range w-full"
                  />
                </div>
              </div>
            {/if}
          </div>
          
          <div class="flex flex-col sm:flex-row gap-3 justify-between">
            <button class="btn btn-secondary" on:click={addAddress}>
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Add Address
            </button>
            
            <button 
              class="btn btn-primary" 
              on:click={findMeetingPoint} 
              disabled={isCalculating}
            >
              {#if isCalculating}
                <span class="loader loader-sm mr-2"></span>
                <span>Calculating...</span>
              {:else}
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <span>Find Meeting Point</span>
              {/if}
            </button>
          </div>
        </div>
        
        <!-- Map Container -->
        <div class="h-[400px] md:h-[500px] rounded-lg overflow-hidden shadow-md map-container">
          <MapContainer 
            center={meetingPoint ? meetingPoint.coordinates : defaultMapCenter}
            zoom={meetingPoint ? undefined : defaultMapZoom}
            markers={mapMarkers}
            routes={routes}
            meetingZoneRadius={meetingZoneRadius}
            animateToResults={animateToResults}
            zoomToFitMarkers={false}
            height="100%"
            on:bounds={handleMapBounds}
          />
        </div>
        
        <!-- Results Card -->
        {#if meetingPoint}
          <div class="card p-4 md:p-6 mt-6 shadow-md results-section">
            <div class="flex justify-between items-start mb-4">
              <h2 class="text-xl font-semibold">Optimal Meeting Point</h2>
              <div class="badge badge-primary">
                <span class="mr-1">📍</span>
                <span>{meetingPoint.name}</span>
              </div>
            </div>
            
            <a 
              href={`https://www.google.com/maps/search/?api=1&query=${meetingPoint.coordinates[1]},${meetingPoint.coordinates[0]}`} 
              target="_blank" 
              rel="noopener noreferrer"
              class="flex items-center text-primary-600 hover:text-primary-700 mb-6"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              Open in Google Maps
            </a>
            
            <h3 class="text-lg font-medium mb-4 pb-2 border-b border-neutral-200">Travel Times & Routes</h3>
            <ul class="space-y-3">
              {#each meetingPoint.travelTimes as time}
                <li class="p-3 bg-bg-subtle rounded-md flex flex-col sm:flex-row sm:justify-between sm:items-center">
                  <div>
                    <p class="font-medium">{time.address}</p>
                    {#if time.transitSummary}
                      <p class="text-sm text-neutral-500">{@html time.transitSummary}</p>
                    {/if}
                  </div>
                  <div class="badge {time.estimated ? 'badge-warning' : 'badge-accent'} mt-2 sm:mt-0">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span>
                      {time.duration} min
                      {#if time.estimated}
                        <span class="text-xs opacity-75">(est.)</span>
                      {/if}
                    </span>
                  </div>
                </li>
              {/each}
            </ul>
            
            <!-- Venues List -->
            {#if venues && venues.length > 0}
              <div class="mt-6 pt-6 border-t border-neutral-200">
                <VenueList 
                  {venues} 
                  loading={isCalculating}
                  on:select={handleVenueSelected}
                />
              </div>
            {:else if showVenues && !isCalculating}
              <div class="mt-6 pt-6 border-t border-neutral-200">
                <h3 class="text-lg font-medium mb-3">Nearby Venues</h3>
                <div class="p-6 bg-bg-subtle rounded-md text-center text-neutral-500">
                  No venues found near this location.
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </MapProvider>
    </div>
  {/if}
</div>

<style>
  .loader {
    border: 3px solid rgba(0, 0, 0, 0.1);
    border-top: 3px solid #3498db;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    animation: spin 1s linear infinite;
  }
  
  .loader-sm {
    width: 16px;
    height: 16px;
    border-width: 2px;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>