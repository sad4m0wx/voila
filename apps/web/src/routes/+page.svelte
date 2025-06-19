<script>
  import { onMount } from "svelte";
  import MapProvider from '$components/maps/MapProvider.svelte';
  import MapContainer from '$components/maps/MapContainer.svelte';
  import { findOptimalMeetingPoint } from "$services/meetingPointApi";
  import { defaultMapCenter, defaultMapZoom, isDebugMode } from "$lib/config.js";
  import AddressForm from "$components/meeting/AddressForm.svelte";
  import MeetingPointResults from "$components/meeting/MeetingPointResults.svelte";
  import VenueOptions from "$components/venues/VenueOptions.svelte";
  import MetroBackground from "$lib/components/MetroBackground.svelte";

  // State
  let addresses = [{ id: 1, value: '', coordinates: null }, { id: 2, value: '', coordinates: null }];
  let meetingPoint = null;
  let meetingPoints = []; // Array of all meeting points
  let currentMeetingPointIndex = 0; // Index of currently selected meeting point
  let routes = [];
  let allRoutes = []; // Array of all route sets
  let venues = [];
  let debugData = null;
  let debugPolygons = [];
  let isCalculating = false;
  let error = null;
  let mapBounds = null;
  let showResults = false;
  let showHeatmap = false;
  let showMovementVectors = false;

  // Venue options
  let showVenues = true;
  let venueTypes = ["restaurant"];
  let venueRadius = 500;

  // Check if we're on mobile
  $: isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Add a state variable to track when to animate to results
  let animateToResults = false;
  
  // Mobile-specific state
  let mobileViewHeight = 0;
  let addressFormHeight = 0;
  

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

    const handleResize = () => {
      if (typeof window !== 'undefined') {
        mobileViewHeight = window.innerHeight;
      }
    };

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
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
    meetingPoints = [];
    allRoutes = [];
    currentMeetingPointIndex = 0;

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

      // Handle multiple meeting points
      meetingPoints = result.allMeetingPoints || [{
        name: result.name,
        coordinates: result.coordinates,
        travel_times: result.travelTimes.map(tt => ({
          id: tt.id,
          address: tt.address,
          duration: tt.duration,
          distance: tt.distance,
          estimated: tt.estimated,
          transit_summary: tt.transitSummary
        }))
      }];

      allRoutes = result.allRoutes || [result.routes || []];

      // Set current meeting point (first one by default)
      currentMeetingPointIndex = 0;
      updateCurrentMeetingPoint();

      venues = result.venues || [];
      debugData = result.debug || null;

      // Convert debug data to polygons for map visualization
      if (debugData) {
        debugPolygons = createDebugPolygons(debugData);
      }

      // Trigger animation to results
      animateToResults = true;

      // Show results
      showResults = true;
      isCalculating = false;
      
    } catch (err) {
      console.error("Error finding meeting point:", err);
      error = err.message || "Failed to calculate meeting point. Please try again.";
      isCalculating = false;
    }
  }

  function updateCurrentMeetingPoint() {
    if (meetingPoints.length > 0 && currentMeetingPointIndex < meetingPoints.length) {
      const currentPoint = meetingPoints[currentMeetingPointIndex];
      meetingPoint = {
        name: currentPoint.name,
        coordinates: currentPoint.coordinates,
        travelTimes: currentPoint.travel_times.map(tt => ({
          id: tt.id,
          address: tt.address,
          duration: tt.duration,
          distance: tt.distance,
          estimated: tt.estimated,
          transitSummary: tt.transit_summary
        }))
      };
      routes = allRoutes[currentMeetingPointIndex] || [];
    }
  }

  function handleMeetingPointChange(event) {
    currentMeetingPointIndex = event.detail.index;
    updateCurrentMeetingPoint();
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

    // Note: POI markers removed - we only show the heatmap and movement vectors

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

    // Add region boundaries for debugging
    if (debugData.regions) {
      debugData.regions.forEach((region, i) => {
        // Create a rectangular polygon from region bounds
        const [minX, minY, maxX, maxY] = region.bounds;
        const regionCoordinates = [[
          [minX, minY],
          [maxX, minY],
          [maxX, maxY],
          [minX, maxY],
          [minX, minY] // Close the polygon
        ]];
        
        polygons.push({
          type: 'region',
          coordinates: regionCoordinates,
          name: `${region.id} (${region.candidates_count} candidates)`,
          regionData: region
        });
      });
    }

    return polygons;
  }

  function handleCreateGroup(event) {
    console.log('Creating group with addresses:', event.detail.addresses);
    window.location.href = '/groups/create';
  }

  function startNewSearch() {
    // Reset all state to start a new search, but not input addresses
    meetingPoint = null;
    meetingPoints = [];
    allRoutes = [];
    currentMeetingPointIndex = 0;
    routes = [];
    venues = [];
    debugData = null;
    debugPolygons = [];
    showHeatmap = false;
    showMovementVectors = false;
    error = null;
    isCalculating = false;
    showResults = false;
    animateToResults = false;
  }
</script>

<svelte:head>
  <title>Voilà! | Find the perfect place to meet</title>
</svelte:head>

<svelte:window bind:scrollY />

<div class="min-h-screen relative overflow-hidden">
  <!-- Enhanced Background Layout - Full Viewport -->
  <div
    class="fixed {isMobile ? 'inset-0' : 'top-20 left-0 right-0 bottom-0'} z-10 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100"
  >
    <!-- Enhanced Background with Multiple Layers -->
    <div
      class="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/10 to-pink-500/5"
    ></div>
    <div
      class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent"
    ></div>
    <MetroBackground />

    <div class="relative z-10 h-full flex flex-col">
      <!-- Mobile Header Space -->
      {#if isMobile}
        <div class="flex-shrink-0 h-16"></div>
      {/if}

      <!-- Main Content Area -->
      <div class="flex-1 {isMobile ? 'px-4 pb-4 overflow-y-auto' : 'container mx-auto px-4 py-4 max-w-[1600px]'} {isMobile ? '' : 'h-0 flex-1 overflow-hidden'}">
        <MapProvider>
          <div slot="loading" class="text-center {isMobile ? 'py-16' : 'py-20'}">
            <div class="loader loader-lg mx-auto mb-4 text-blue-600"></div>
            <p class="text-secondary-600 font-medium">
              Loading map services...
            </p>
          </div>

          <div slot="error" let:error class="text-center {isMobile ? 'py-16' : 'py-20'}">
            <div
              class="card card-gradient p-{isMobile ? '6' : '8'} max-w-{isMobile ? 'sm' : 'md'} mx-auto bg-gradient-to-br from-red-50 to-orange-50 border-red-200"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-{isMobile ? '10' : '12'} w-{isMobile ? '10' : '12'} mx-auto mb-{isMobile ? '3' : '4'} text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p class="text-{isMobile ? 'base' : 'lg'} mb-2 font-semibold text-red-700">{error}</p>
              <p class="text-secondary-600 {isMobile ? 'text-sm' : ''}">
                Please refresh the page to try again.
              </p>
            </div>
          </div>

                     <!-- Mobile Layout -->
           {#if isMobile}
             <div class="flex flex-col space-y-4 h-full">
              <!-- Address Form / Loading / Results Section -->
              <div class="flex-shrink-0 {showResults && meetingPoint ? 'max-h-[50vh]' : ''}">
                <div class="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/30 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] p-4">
                  
                  {#if isCalculating}
                    <!-- Mobile Loading State -->
                    <div class="text-center py-8 animate-fade-in">
                      <div class="relative mb-6">
                        <!-- Animated loading rings -->
                        <div class="w-16 h-16 mx-auto relative">
                          <div class="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
                          <div class="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                          <div class="absolute inset-2 border-2 border-purple-300 rounded-full border-b-transparent animate-spin animate-reverse" style="animation-duration: 1.5s;"></div>
                        </div>
                        <!-- Floating dots animation -->
                        <div class="absolute -top-2 left-1/2 transform -translate-x-1/2">
                          <div class="flex space-x-1">
                            <div class="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style="animation-delay: 0s;"></div>
                            <div class="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style="animation-delay: 0.1s;"></div>
                            <div class="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style="animation-delay: 0.2s;"></div>
                          </div>
                        </div>
                      </div>
                      
                      <h3 class="text-lg font-bold text-slate-800 mb-2">Finding your perfect spot...</h3>
                      <p class="text-slate-600 text-sm mb-4">Analyzing {addresses.length} locations</p>
                      
                      <!-- Progress indicators -->
                      <div class="space-y-2">
                        <div class="flex items-center justify-center space-x-2 text-xs text-slate-500">
                          <div class="flex items-center">
                            <div class="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse"></div>
                            Calculating routes
                          </div>
                        </div>
                        <div class="flex items-center justify-center space-x-2 text-xs text-slate-500">
                          <div class="flex items-center">
                            <div class="w-2 h-2 bg-blue-400 rounded-full mr-1 animate-pulse" style="animation-delay: 0.5s;"></div>
                            Finding venues
                          </div>
                        </div>
                      </div>
                    </div>
                  {:else if meetingPoint && showResults}
                    <!-- Condensed Address Form when results are shown -->
                    <div class="mb-4">
                      <div class="card card-gradient p-3 animate-fade-in">
                        <div class="flex items-center justify-between">
                          <div class="flex items-center">
                            <span class="text-sm font-medium text-secondary-700 mr-2">
                              {addresses.length} addresses
                            </span>
                            <div class="flex items-center space-x-1">
                              {#each addresses.slice(0, 3) as address, i}
                                <div class="w-2 h-2 rounded-full bg-primary-400"></div>
                              {/each}
                              {#if addresses.length > 3}
                                <span class="text-xs text-secondary-500">+{addresses.length - 3}</span>
                              {/if}
                            </div>
                          </div>
                          <button 
                            class="btn btn-outline btn-sm text-xs px-3 py-1"
                            on:click={startNewSearch}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M3 3l18 18M21 3l-18 18"/>
                            </svg>
                            New Search
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Mobile Results -->
                    <div class="overflow-y-auto scrollbar-thin" style="max-height: calc(50vh - 6rem);">
                      <MeetingPointResults
                        {meetingPoint}
                        {meetingPoints}
                        {currentMeetingPointIndex}
                        {venues}
                        {routes}
                        {isCalculating}
                        {isMobile}
                        on:venue-selected={(e) => console.log("Venue selected:", e.detail)}
                        on:toggle-results={toggleResults}
                        on:meeting-point-change={handleMeetingPointChange}
                      />
                    </div>
                  {:else}
                    <!-- Enhanced Header Section -->
                    <div class="mb-4 relative">
                      <div class="relative">
                        <div class="flex items-center mb-3">
                          <div class="relative">
                            <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg transform rotate-3">
                              <span class="text-base">📍</span>
                            </div>
                            <div class="absolute -top-0.5 -right-0.5 w-3 h-3 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-md">
                              <span class="text-xs">✨</span>
                            </div>
                          </div>
                          <div class="ml-3">
                            <h1 class="text-lg font-bold bg-gradient-to-r from-slate-800 via-blue-700 to-purple-700 bg-clip-text text-transparent leading-tight">
                              Voilà!
                            </h1>
                            <p class="text-slate-600 font-medium text-xs">
                              Find the perfect meeting spot
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Full Address Form -->
                    <AddressForm
                      bind:addresses
                      {isCalculating}
                      {mapBounds}
                      {error}
                      on:addresses-changed={(e) => (addresses = e.detail.addresses)}
                      on:find-meeting-point={findMeetingPoint}
                      on:error={(e) => (error = e.detail.message)}
                      on:create-group={handleCreateGroup}
                    />
                  {/if}
                </div>
              </div>

                             <!-- Map Section - Fixed height for mobile -->
               <div class="h-80 flex-shrink-0">
                <div class="h-full relative">
                  <div class="h-full rounded-xl overflow-hidden shadow-lg bg-gradient-to-br from-blue-100/80 to-purple-100/80 backdrop-blur-sm border-2 border-blue-200/50">
                    <MapContainer
                      center={meetingPoint
                        ? meetingPoint.coordinates
                        : defaultMapCenter}
                      zoom={meetingPoint ? undefined : defaultMapZoom}
                      markers={mapMarkers}
                      {routes}
                      polygons={isDebugMode ? debugPolygons : []}
                      {meetingZoneRadius}
                      {animateToResults}
                      zoomToFitMarkers={false}
                      height="100%"
                      heatmapData={isDebugMode ? debugData?.heatmap_data : null}
                      showHeatmap={isDebugMode ? showHeatmap : false}
                      showMovementVectors={isDebugMode ? showMovementVectors : false}
                      on:bounds={handleMapBounds}
                    />
                  </div>
                </div>
              </div>
            </div>
          {:else}
            <!-- Desktop Layout (unchanged) -->
            <div class="h-full grid grid-cols-12 gap-4">
              
              <!-- Left Sidebar -->
              <div class="col-span-5 flex flex-col h-full min-h-0">
                
                <!-- Glassmorphic Container -->
                <div class="flex flex-col h-full bg-white/70 backdrop-blur-xl rounded-2xl border border-white/30 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] overflow-hidden">
                  
                  <!-- Enhanced Header Section -->
                  <div class="flex-shrink-0 p-4 relative">
                    <!-- Decorative Elements -->
                    <div class="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-400/15 to-purple-400/15 rounded-full blur-2xl -translate-y-4 translate-x-4"></div>
                    <div class="absolute -top-2 -left-2 w-12 h-12 bg-gradient-to-br from-pink-400/15 to-orange-400/15 rounded-full blur-xl"></div>

                    <div class="relative">
                      <div class="flex items-center mb-3">
                        <div class="relative">
                          <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg transform rotate-3">
                            <span class="text-lg">📍</span>
                          </div>
                          <div class="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-md">
                            <span class="text-xs">✨</span>
                          </div>
                        </div>
                        <div class="ml-4">
                          <h1 class="text-xl font-bold bg-gradient-to-r from-slate-800 via-blue-700 to-purple-700 bg-clip-text text-transparent leading-tight">
                            Voilà!
                          </h1>
                          <p class="text-slate-600 font-medium text-sm">
                            Find the perfect meeting spot
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Divider with Gradient -->
                  <div class="flex-shrink-0 h-px bg-gradient-to-r from-transparent via-slate-300/50 to-transparent mx-4"></div>

                  <!-- Address Form Section -->
                  {#if meetingPoint && showResults}
                    <!-- Condensed Address Form when results are shown -->
                    <div class="flex-shrink-0 p-4 py-2">
                      <div class="card card-gradient p-2 animate-fade-in">
                        <div class="flex items-center justify-between">
                          <div class="flex items-center">
                            <span class="text-sm font-medium text-secondary-700 mr-2">
                              {addresses.length} addresses
                            </span>
                            <div class="flex items-center space-x-1">
                              {#each addresses.slice(0, 3) as address, i}
                                <div class="w-2 h-2 rounded-full bg-primary-400"></div>
                              {/each}
                              {#if addresses.length > 3}
                                <span class="text-xs text-secondary-500">+{addresses.length - 3}</span>
                              {/if}
                            </div>
                          </div>
                          <button 
                            class="btn btn-outline btn-sm text-xs px-3 py-1"
                            on:click={startNewSearch}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M3 3l18 18M21 3l-18 18"/>
                            </svg>
                            New Search
                          </button>
                        </div>
                      </div>
                    </div>
                  {:else}
                    <!-- Full Address Form when no results -->
                    <div class="flex-shrink-0 p-4 py-3">
                      <AddressForm
                        bind:addresses
                        {isCalculating}
                        {mapBounds}
                        {error}
                        on:addresses-changed={(e) => (addresses = e.detail.addresses)}
                        on:find-meeting-point={findMeetingPoint}
                        on:error={(e) => (error = e.detail.message)}
                        on:create-group={handleCreateGroup}
                      />
                    </div>
                  {/if}

                  <!-- Results Section -->
                  <div class="flex-1 overflow-y-auto p-4 pt-2 scrollbar-thin min-h-0">
                    {#if meetingPoint}
                      <!-- Results Header -->
                      <div class="flex items-center justify-between mb-3 pb-2 border-b border-slate-200/50">
                        <div class="flex items-center">
                          <span class="text-lg mr-2">🎯</span>
                          <h3 class="text-lg font-bold text-secondary-800">Meeting Results</h3>
                        </div>
                        <div class="flex items-center space-x-2">
                          {#if isDebugMode && debugData?.heatmap_data}
                            <button
                              class="btn btn-sm {showHeatmap ? 'btn-primary' : 'btn-outline'} text-xs px-2 py-1"
                              on:click={() => showHeatmap = !showHeatmap}
                              title="Toggle POI heatmap - Shows transit hubs, restaurants, and public spaces"
                            >
                              🔥 Heatmap
                            </button>
                            <button
                              class="btn btn-sm {showMovementVectors ? 'btn-primary' : 'btn-outline'} text-xs px-2 py-1"
                              on:click={() => showMovementVectors = !showMovementVectors}
                              title="Show candidate movement vectors - How grid points moved toward POI hotspots"
                            >
                              ➡️ Vectors
                            </button>
                          {/if}
                          <div class="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                            Found
                          </div>
                        </div>
                      </div>
                      
                      <MeetingPointResults
                        {meetingPoint}
                        {meetingPoints}
                        {currentMeetingPointIndex}
                        {venues}
                        {routes}
                        {isCalculating}
                        {isMobile}
                        on:venue-selected={(e) => console.log("Venue selected:", e.detail)}
                        on:toggle-results={toggleResults}
                        on:meeting-point-change={handleMeetingPointChange}
                      />
                      
                      <!-- Heatmap Info -->
                      {#if isDebugMode && (showHeatmap || showMovementVectors) && debugData?.heatmap_data}
                        <div class="mt-4 p-3 bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg">
                          <div class="flex items-center mb-2">
                            <span class="text-sm mr-2">{showHeatmap ? '🔥' : '➡️'}</span>
                            <h4 class="text-sm font-bold text-orange-800">
                              {showHeatmap && showMovementVectors ? 'Heatmap & Vectors Active' : 
                               showHeatmap ? 'POI Heatmap Active' : 'Movement Vectors Active'}
                            </h4>
                          </div>
                          <div class="text-xs text-orange-700 space-y-1">
                            <p>• {debugData.heatmap_data.poi_locations.length} POIs found</p>
                            <p>• {debugData.heatmap_data.optimization_stats.optimized_candidates} optimized candidates</p>
                            <p>• {debugData.heatmap_data.optimization_stats.candidates_moved} candidates moved toward hotspots</p>
                            {#if debugData.heatmap_data.optimization_stats.average_movement_distance > 0}
                              <p>• Avg movement: {debugData.heatmap_data.optimization_stats.average_movement_distance.toFixed(0)}m</p>
                            {/if}
                            {#if showMovementVectors}
                              <p>• <span class="text-green-600">Green arrows:</span> High heat improvement</p>
                              <p>• <span class="text-orange-600">Orange arrows:</span> Moderate improvement</p>
                              <p>• <span class="text-blue-600">Blue arrows:</span> Small improvement</p>
                              <p>• <span class="text-gray-500">Gray arrows:</span> Rejected candidates</p>
                            {/if}
                          </div>
                        </div>
                      {/if}
                    {:else if !isCalculating}
                      <!-- Enhanced Empty State -->
                      <div class="flex flex-col items-center justify-center h-full">
                        <div class="relative">
                          <!-- Animated Background Elements -->
                          <div class="absolute inset-0 bg-gradient-to-br from-blue-100/50 to-purple-100/50 rounded-full blur-xl scale-150 animate-pulse"></div>
                          <div class="relative bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-4 text-center border border-green-200/50 shadow-lg backdrop-blur-sm">
                            <div class="relative mb-3">
                              <svg
                                class="w-12 h-12 mx-auto text-green-500/70 animate-float"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fill-rule="evenodd"
                                  d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                                  clip-rule="evenodd"
                                />
                              </svg>
                              <div class="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-yellow-300 to-orange-400 rounded-full flex items-center justify-center shadow-md animate-bounce-subtle">
                                <span class="text-xs">✨</span>
                              </div>
                            </div>
                            <h3 class="text-base font-bold text-green-700 mb-2">
                              Ready to find your spot?
                            </h3>
                            <p class="text-green-600 text-xs mb-2 leading-relaxed">
                              Enter addresses above and we'll find the perfect
                              meeting point.
                            </p>
                            <div class="flex items-center justify-center space-x-2 text-xs text-green-500 pb-2">
                              <div class="flex items-center">
                                <div class="w-1 h-1 bg-green-400 rounded-full mr-1"></div>
                                Real-time routing
                              </div>
                              <div class="flex items-center">
                                <div class="w-1 h-1 bg-blue-400 rounded-full mr-1"></div>
                                Venue suggestions
                              </div>
                            </div>
                            <!-- Stats or Visual Elements -->
                            <div class="grid grid-cols-3 gap-2 text-center">
                              <div class="bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-white/40">
                                <div class="text-sm font-bold text-blue-600">
                                  🚀
                                </div>
                                <div class="text-xs text-slate-600 font-medium">
                                  Fast
                                </div>
                              </div>
                              <div class="bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-white/40">
                                <div class="text-sm font-bold text-green-600">
                                  🎯
                                </div>
                                <div class="text-xs text-slate-600 font-medium">
                                  Precise
                                </div>
                              </div>
                              <div class="bg-white/60 backdrop-blur-sm rounded-lg p-2 border border-white/40">
                                <div class="text-sm font-bold text-purple-600">
                                  ✨
                                </div>
                                <div class="text-xs text-slate-600 font-medium">
                                  Smart
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    {/if}
                  </div>
                </div>
              </div>

              <!-- Map Section -->
              <div class="col-span-7 h-full">
                <div class="h-full relative">
                  <!-- Map Container with Enhanced Styling -->
                  <div class="h-full rounded-2xl overflow-hidden shadow-[0_20px_50px_0_rgba(8,47,73,0.11)] border border-white/20 bg-gradient-to-br from-blue-50/30 via-white/50 to-purple-50/30 backdrop-blur-sm">
                    <MapContainer
                      center={meetingPoint
                        ? meetingPoint.coordinates
                        : defaultMapCenter}
                      zoom={meetingPoint ? undefined : defaultMapZoom}
                      markers={mapMarkers}
                      {routes}
                      polygons={isDebugMode ? debugPolygons : []}
                      {meetingZoneRadius}
                      {animateToResults}
                      zoomToFitMarkers={false}
                      height="100%"
                      heatmapData={isDebugMode ? debugData?.heatmap_data : null}
                      showHeatmap={isDebugMode ? showHeatmap : false}
                      showMovementVectors={isDebugMode ? showMovementVectors : false}
                      on:bounds={handleMapBounds}
                    />
                  </div>
                </div>
              </div>
            </div>
          {/if}
        </MapProvider>
      </div>
    </div>
  </div>
</div>

<style>
  .loader {
    border: 3px solid rgba(0, 0, 0, 0.1);
    border-top: 3px solid #2563eb;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes bounce-subtle {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-5px);
    }
  }

  @keyframes float {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-10px);
    }
  }

  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-bounce-subtle {
    animation: bounce-subtle 3s ease-in-out infinite;
  }

  .animate-float {
    animation: float 4s ease-in-out infinite;
  }

  .animate-fade-in {
    animation: fade-in 0.5s ease-out;
  }

  .animate-reverse {
    animation-direction: reverse;
  }

  /* Enhanced Scrollbar */
  .scrollbar-thin::-webkit-scrollbar {
    width: 4px;
  }

  .scrollbar-thin::-webkit-scrollbar-track {
    background: rgba(148, 163, 184, 0.1);
    border-radius: 2px;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: linear-gradient(to bottom, #3b82f6, #8b5cf6);
    border-radius: 2px;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(to bottom, #2563eb, #7c3aed);
  }

  /* Responsive Container Max Width */
  .container {
    max-width: 1600px;
  }
</style>
