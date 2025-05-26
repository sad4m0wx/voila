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
  let venueRadius = 500;
  
  // Check if we're on mobile
  $: isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  $: mapHeight = isMobile ? 'calc(40vh)' : '500px';
  
  // Add a state variable to track when to animate to results
  let animateToResults = false;
  
  async function findMeetingPoint() {
    // Reset state
    error = null;
    isCalculating = true;
    showResults = false;
    venues = [];
    animateToResults = false;
    
    try {
      // Validate inputs
      if (addresses.some(addr => !addr.value.trim())) {
        throw new Error("All addresses must be filled");
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
          isCalculating = false;
        }, 1000);
      } else {
        isCalculating = false;
      }
      
    } catch (err) {
      console.error("Error finding meeting point:", err);
      error = err.message || "Failed to calculate meeting point. Please try again.";
      isCalculating = false;
    }
  }
  
  function handleMapBounds(event) {
    mapBounds = event.detail.bounds;
  }
  
  function toggleResults() {
    showResults = !showResults;
  }

  // Create map markers for all locations
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
            <AddressForm 
              bind:addresses={addresses}
              {isCalculating}
              {mapBounds}
              {error}
              on:addresses-changed={(e) => addresses = e.detail.addresses}
              on:find-meeting-point={findMeetingPoint}
              on:error={(e) => error = e.detail.message}
            >
              <!--
              <VenueOptions 
                slot="venue-options"
                bind:showVenues={showVenues}
                bind:venueTypes={venueTypes}
                bind:venueRadius={venueRadius}
                {isCalculating}
                on:venue-options-changed={(e) => {
                  showVenues = e.detail.showVenues;
                  venueTypes = e.detail.venueTypes;
                  venueRadius = e.detail.venueRadius;
                }}
              /> -->
            </AddressForm>
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
            
            <MeetingPointResults 
              {meetingPoint}
              {venues}
              {showVenues}
              {isCalculating}
              {isMobile}
              on:venue-selected={(e) => console.log('Venue selected:', e.detail)}
              on:toggle-results={toggleResults}
            />
          </div>
        {/if}
      </MapProvider>
    </div>
    
  {:else}
    <!-- Desktop view - simplified but complete -->
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
        <AddressForm 
          bind:addresses={addresses}
          {isCalculating}
          {mapBounds}
          {error}
          on:addresses-changed={(e) => addresses = e.detail.addresses}
          on:find-meeting-point={findMeetingPoint}
          on:error={(e) => error = e.detail.message}
        >
        <!--
          <VenueOptions 
            slot="venue-options"
            bind:showVenues={showVenues}
            bind:venueTypes={venueTypes}
            bind:venueRadius={venueRadius}
            {isCalculating}
            on:venue-options-changed={(e) => {
              showVenues = e.detail.showVenues;
              venueTypes = e.detail.venueTypes;
              venueRadius = e.detail.venueRadius;
            }}
          /> -->
        </AddressForm>
        
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
        <MeetingPointResults 
          {meetingPoint}
          {venues}
          {showVenues}
          {isCalculating}
          {isMobile}
          on:venue-selected={(e) => console.log('Venue selected:', e.detail)}
        />
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
