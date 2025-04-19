<!-- src/routes/+page.svelte -->
<script>
  import { isAuthenticated } from "$lib/stores/auth";
  import { onMount } from "svelte";
  import MobileAddressInput from "$lib/components/MobileAddressInput.svelte";
  import MobileGoogleMap from "$lib/components/MobileGoogleMap.svelte";
  import SecureGoogleMapsProvider from "$lib/components/SecureGoogleMapsProvider.svelte";
  import { findOptimalMeetingPoint } from "$lib/services/meetingPointApi";
  import { defaultMapCenter, defaultMapZoom } from "$lib/config.js";
  
  // State
  let addresses = [{ id: 1, value: '', coordinates: null }];
  let nextId = 2;
  let meetingPoint = null;
  let routes = [];
  let isCalculating = false;
  let error = null;
  let mapsReady = false;
  let mapBounds = null;
  let showResults = false;
  
  // Add a second address by default
  addresses = [...addresses, { id: nextId++, value: '', coordinates: null }];
  
  // Check if we're on mobile
  $: isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  
  function handleMapsReady(event) {
    mapsReady = true;
  }
  
  function handleMapBounds(event) {
    mapBounds = event.detail.bounds;
  }
  
  function handleMapsError(event) {
    error = event.detail.message;
  }
  
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
  
  async function findMeetingPoint() {
    // Reset state
    error = null;
    isCalculating = true;
    showResults = false;
    
    try {
      // Validate inputs
      if (addresses.some(addr => !addr.value.trim())) {
        throw new Error("All addresses must be filled");
      }
      
      if (!mapsReady) {
        throw new Error("Map is not ready yet. Please wait a moment and try again.");
      }
      
      // Calculate meeting point
      const result = await findOptimalMeetingPoint(addresses);
      
      // Update state with result
      meetingPoint = {
        name: result.name,
        coordinates: result.coordinates,
        travelTimes: result.travelTimes
      };
      
      routes = result.routes || [];
      
      // Show results on mobile
      if (isMobile) {
        setTimeout(() => {
          showResults = true;
        }, 500);
      }
      
    } catch (err) {
      console.error("Error finding meeting point:", err);
      error = err.message || "Failed to calculate meeting point. Please try again.";
    } finally {
      isCalculating = false;
    }
  }
  
  function handlePlaceSelected(event, addressId) {
    const { address, location } = event.detail;
    const coordinates = [location.lng, location.lat]; // Convert to [longitude, latitude]
    updateAddressWithCoordinates(addressId, address, coordinates);
  }
  
  function toggleResults() {
    showResults = !showResults;
  }
</script>

<svelte:head>
  <title>Voilà! | Find the perfect place to meet</title>
  <meta name="description" content="Calculate the optimal meeting point for you and your friends" />
</svelte:head>

<div class="bg-gradient-to-b from-primary-50 to-white">
  <div class="container mx-auto px-4 py-12 md:py-20">
    <div class="text-center max-w-3xl mx-auto mb-12">
      <div class="flex justify-center items-center mb-4">
        <span class="text-5xl animate-bounce inline-block mr-3">📍</span>
        <h1 class="text-4xl md:text-5xl font-bold text-primary-700">Voilà!</h1>
      </div>
      <p class="text-xl md:text-2xl text-neutral-700 mb-6">Find the perfect place to meet with your friends.</p>
      {#if !$isAuthenticated}
        <div class="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <a href="/register" class="btn btn-primary">Create Account</a>
          <a href="/login" class="btn btn-outline">Sign In</a>
        </div>
      {/if}
    </div>
    
    <div class="max-w-4xl mx-auto">
      <SecureGoogleMapsProvider
        on:ready={handleMapsReady}
        on:error={handleMapsError}
      >
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
        
        {#if mapsReady}
          <div class="card p-4 md:p-6 mb-6 shadow-md">
            <h2 class="text-xl font-semibold mb-6">Enter Addresses</h2>
            
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
                <MobileAddressInput 
                  value={address.value} 
                  onUpdate={(value) => updateAddress(address.id, value)} 
                  onRemove={() => removeAddress(address.id)}
                  placeholder="Enter an address or location"
                  mapBounds={mapBounds}
                  on:place-selected={(e) => handlePlaceSelected(e, address.id)}
                />
              {/each}
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
          
          <div class="h-[400px] md:h-[500px] rounded-lg overflow-hidden shadow-md">
            <MobileGoogleMap 
              meetingPoint={meetingPoint} 
              routes={routes}
              on:bounds={handleMapBounds}
              myLocationControl={true}
              gestureHandling="greedy"
            />
            
            {#if isMobile && meetingPoint}
              <button 
                class="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-10 
                       bg-white shadow-lg rounded-full py-2 px-6 flex items-center
                       border border-neutral-200"
                on:click={toggleResults}
              >
                <span class="font-medium">{showResults ? "Hide Details" : "Show Details"}</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 ml-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                     style={`transform: rotate(${showResults ? 180 : 0}deg); transition: transform 0.2s`}>
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
            {/if}
          </div>
          
          {#if (!isMobile || showResults) && meetingPoint}
            <div class="card p-4 md:p-6 mt-6 shadow-md {isMobile ? 'rounded-t-lg' : ''}">
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
            </div>
          {/if}
        {/if}
      </SecureGoogleMapsProvider>
    </div>
  </div>
</div>


{#if !$isAuthenticated}
  <div class="bg-primary-50 py-16">
    <div class="container mx-auto px-4">
      <div class="max-w-4xl mx-auto text-center">
        <h2 class="text-2xl md:text-3xl font-bold mb-4">Ready to find the perfect meeting spot?</h2>
        <p class="text-lg text-neutral-700 mb-8">Create an account to save your favorite locations and coordinate with friends!</p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <a href="/register" class="btn btn-primary">Get Started</a>
          <a href="/login" class="btn btn-outline">Sign In</a>
        </div>
      </div>
    </div>
  </div>
{/if}