<script>
  import { onMount } from "svelte";
  import MapProvider from '$components/maps/MapProvider.svelte';
  import MapContainer from '$components/maps/MapContainer.svelte';
  import { findOptimalMeetingPoint } from "$services/meetingPointApi";
  import { defaultMapCenter, defaultMapZoom } from "$lib/config.js";
  import AddressForm from "$components/meeting/AddressForm.svelte";
  import MeetingPointResults from "$components/meeting/MeetingPointResults.svelte";
  import VenueOptions from "$components/venues/VenueOptions.svelte";
  import MetroBackground from "$lib/components/MetroBackground.svelte";
  
  // State
  let addresses = [{ id: 1, value: '', coordinates: null }, { id: 2, value: '', coordinates: null }];
  let meetingPoint = null;
  let routes = [];
  let venues = [];
  let debugData = null;
  let debugPolygons = [];
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
  
  // Add a state variable to track when to animate to results
  let animateToResults = false;
  
  
  // Parallax effect for metro animation
  let scrollY = 0;
  let parallaxContainer;
  
  onMount(() => {
    const handleScroll = () => {
      scrollY = window.scrollY;
      if (parallaxContainer) {
        parallaxContainer.style.transform = `translateY(${scrollY * 0.3}px)`;
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  });
  
  async function findMeetingPoint() {
    // Reset state
    error = null;
    isCalculating = true;
    showResults = false;
    venues = [];
    debugData = null;
    debugPolygons = [];
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
      debugData = result.debug || null;
      
      // Convert debug data to polygons for map visualization
      if (debugData) {
        debugPolygons = createDebugPolygons(debugData);
      }
      
      // Trigger animation to results
      animateToResults = true;
      
      // Show results and auto-scroll
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
  
  // Convert debug data to polygons for map visualization
  function createDebugPolygons(debugData) {
    const polygons = [];
    
    // Add isochrone polygons
    if (debugData.isochrones) {
      debugData.isochrones.forEach((isochrone, i) => {
        if (isochrone.polygon && isochrone.polygon.coordinates) {
          polygons.push({
            type: 'isochrone',
            coordinates: isochrone.polygon.coordinates,
            name: `Isochrone ${i + 1} (${isochrone.origin_address})`
          });
        }
      });
    }
    
    // Add intersection polygons
    if (debugData.intersections) {
      debugData.intersections.forEach((intersection, i) => {
        if (intersection.polygon && intersection.polygon.coordinates) {
          polygons.push({
            type: 'intersection',
            coordinates: intersection.polygon.coordinates,
            name: `Intersection ${i + 1}`
          });
        }
      });
    }
    
    return polygons;
  }
</script>

<svelte:head>
  <title>Voilà! | Find the perfect place to meet</title>
</svelte:head>

<svelte:window bind:scrollY />

<div class="bg-gradient-to-br from-blue-100 via-purple-50 to-pink-100 min-h-screen relative overflow-hidden">
  <MetroBackground />

  {#if isMobile}    
    <div class="pt-4 relative z-10">
      <MapProvider>
        <div slot="loading" class="text-center py-16">
          <div class="loader loader-lg mx-auto mb-4 text-blue-600"></div>
          <p class="text-secondary-600 font-medium">Loading map services...</p>
        </div>
        
        <div slot="error" let:error class="text-center py-16 px-4">
          <div class="card card-gradient p-8 max-w-sm mx-auto bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p class="text-lg mb-2 font-semibold text-red-700">{error}</p>
            <p class="text-secondary-600">Please refresh the page to try again.</p>
          </div>
        </div>

        <!-- Results Section -->
        {#if showResults && meetingPoint}
          <div class="results-view pb-5">
            <MeetingPointResults 
              {meetingPoint}
              {venues}
              {routes}
              {isCalculating}
              {isMobile}
              on:venue-selected={(e) => console.log('Venue selected:', e.detail)}
              on:toggle-results={toggleResults}
            />
          </div>
        {/if}
        
        <!-- Mobile View Layout -->
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

        <!-- Single Map Container for Mobile -->
        <div class="rounded-xl overflow-hidden shadow-lg map-container h-[40vh] mb-4 mx-4 relative bg-gradient-to-br from-blue-100/80 to-purple-100/80 backdrop-blur-sm border-2 border-blue-200/50">
          <MapContainer 
            center={meetingPoint ? meetingPoint.coordinates : defaultMapCenter}
            zoom={meetingPoint ? undefined : defaultMapZoom}
            markers={mapMarkers}
            routes={routes}
            polygons={debugPolygons}
            meetingZoneRadius={meetingZoneRadius}
            animateToResults={animateToResults}
            zoomToFitMarkers={false}
            height="100%"
            on:bounds={handleMapBounds}
          />
          
          <!-- Show back button only when showing results -->
          {#if showResults && meetingPoint}
            <button 
              class="absolute top-4 left-4 z-10 btn btn-sm bg-gradient-to-r from-blue-500 to-purple-500 text-white backdrop-blur-sm shadow-lg hover:from-blue-600 hover:to-purple-600 transition-all"
              on:click={toggleResults}
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
              </svg>
            </button>
          {/if}
        </div>
        
        
      </MapProvider>
    </div>

  {:else}
    <!-- Desktop Layout - Side by Side -->
    <div class="relative z-10 min-h-screen">
      
      <!-- Main Content -->
      <div class="max-w-7xl mx-auto px-6 py-6">
        <MapProvider>
          <div slot="loading" class="text-center py-20">
            <div class="loader loader-lg mx-auto mb-4 text-blue-600"></div>
            <p class="text-secondary-600 font-medium">Loading map services...</p>
          </div>
          
          <div slot="error" let:error class="text-center py-20">
            <div class="card card-gradient p-8 max-w-md mx-auto bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p class="text-lg mb-2 font-semibold text-red-700">{error}</p>
              <p class="text-secondary-600">Please refresh the page to try again.</p>
            </div>
          </div>
          
          <div class="grid lg:grid-cols-5 gap-6 h-[calc(100vh-48px)]">
            <!-- Left Sidebar - Form and Results -->
            <div class="lg:col-span-2 flex flex-col space-y-4 overflow-y-auto bg-gradient-to-br from-blue-100/60 via-white/80 to-purple-100/60 backdrop-blur-md rounded-2xl p-6 border-2 border-blue-200/50 shadow-2xl">
              <!-- Header inside sidebar -->
              <div class="flex-shrink-0 pb-4 border-b border-gradient-to-r from-blue-200 to-purple-200">
                <div class="flex items-center">
                  <span class="text-3xl mr-3 animate-bounce-subtle">📍</span>
                  <div>
                    <h1 class="text-xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">Voilà!</h1>
                    <p class="text-sm text-secondary-600">Find the perfect meeting spot</p>
                  </div>
                </div>
              </div>
              
              <!-- Address Form -->
              <div class="flex-shrink-0">
                <AddressForm 
                  bind:addresses={addresses}
                  {isCalculating}
                  {mapBounds}
                  {error}
                  on:addresses-changed={(e) => addresses = e.detail.addresses}
                  on:find-meeting-point={findMeetingPoint}
                  on:error={(e) => error = e.detail.message}
                />
              </div>
              
              <!-- Results -->
              {#if meetingPoint}
                <div class="flex-1">
                  <MeetingPointResults 
                    {meetingPoint}
                    {venues}
                    {isCalculating}
                    {isMobile}
                    on:venue-selected={(e) => console.log('Venue selected:', e.detail)}
                  />
                </div>
              {:else}
                <!-- Placeholder when no results -->
                <div class="flex-1 flex items-center justify-center">
                  <div class="text-center text-secondary-500 bg-gradient-to-br from-green-50/80 to-blue-50/80 rounded-xl p-4 border-2 border-green-200/50 shadow-lg">
                    <svg class="w-16 h-16 mx-auto mb-4 text-green-500 opacity-70" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                    </svg>
                    <p class="text-lg font-medium mb-2 text-green-700">Enter addresses to get started</p>
                    <p class="text-sm text-green-600">We'll find the perfect meeting point for everyone</p>
                  </div>
                </div>
              {/if}
            </div>
            
            <!-- Right Side - Map -->
            <div class="lg:col-span-3">
              <div class="h-full rounded-2xl overflow-hidden shadow-2xl border-3 border-gradient-to-r from-purple-200 to-pink-200 bg-gradient-to-br from-purple-100/40 via-white/60 to-pink-100/40 backdrop-blur-sm">
                <MapContainer 
                  center={meetingPoint ? meetingPoint.coordinates : defaultMapCenter}
                  zoom={meetingPoint ? undefined : defaultMapZoom}
                  markers={mapMarkers}
                  routes={routes}
                  polygons={debugPolygons}
                  meetingZoneRadius={meetingZoneRadius}
                  animateToResults={animateToResults}
                  zoomToFitMarkers={false}
                  height="100%"
                  on:bounds={handleMapBounds}
                />
              </div>
            </div>
          </div>
        </MapProvider>
      </div>
    </div>
  {/if}
  
</div>

<style>
  .loader {
    border: 3px solid rgba(0, 0, 0, 0.1);
    border-top: 3px solid #2563EB;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .animate-bounce-subtle {
    animation: bounce-subtle 3s ease-in-out infinite;
  }
  
  @keyframes bounce-subtle {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
  }
  
  /* Custom scrollbar for sidebar */
  .overflow-y-auto::-webkit-scrollbar {
    width: 6px;
  }
  
  .overflow-y-auto::-webkit-scrollbar-track {
    background: rgba(147, 197, 253, 0.2);
  }
  
  .overflow-y-auto::-webkit-scrollbar-thumb {
    background: linear-gradient(to bottom, #3B82F6, #8B5CF6);
    border-radius: 3px;
  }
  
  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(to bottom, #2563EB, #7C3AED);
  }
</style>
