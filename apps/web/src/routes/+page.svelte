<script>
  import { onMount } from "svelte";
  import MapProvider from '$components/maps/MapProvider.svelte';
  import MapContainer from '$components/maps/MapContainer.svelte';
  import { findOptimalMeetingPoint } from "$services/meetingPointApi";
  import { defaultMapCenter, defaultMapZoom, isDebugMode } from "$lib/config.js";
  import AddressForm from "$components/meeting/AddressForm.svelte";
  import MeetingPointDisplay from "$components/meeting/MeetingPointDisplay.svelte";
  import VenueOptions from "$components/venues/VenueOptions.svelte";
  import MetroBackground from "$lib/components/MetroBackground.svelte";
  import ResponsiveQuickActions from "$components/core/ResponsiveQuickActions.svelte";
  
  import { authStore } from "$stores/auth";

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
  let mapExpanded = false;

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

    window.addEventListener('scroll', handleResize);
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call

    // Check for shared meeting point parameter
    checkForSharedMeetingPoint();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  });

  async function checkForSharedMeetingPoint() {
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('share');
    
    if (shareId) {
      try {
        isCalculating = true;
        showResults = false;
        
        // Import the share service
        const { getSharedMeetingPoint } = await import('$lib/services/shareService.js');
        const result = await getSharedMeetingPoint(shareId);
        
        if (result.success && result.meetingPointResult) {
          const data = result.meetingPointResult;
          
          // Extract meeting point (use first one if multiple)
          if (data.meeting_points && data.meeting_points.length > 0) {
            const mp = data.meeting_points[0];
            meetingPoint = {
              name: mp.name,
              coordinates: mp.coordinates,
              travelTimes: mp.travel_times || []
            };
            
            meetingPoints = [meetingPoint];
            currentMeetingPointIndex = 0;
          }
          
          // Extract venues and routes
          venues = data.venues || [];
          routes = (data.routes && data.routes.length > 0) ? data.routes[0] : [];
          allRoutes = [routes];
          
          // Create addresses from travel times for display
          if (meetingPoint && meetingPoint.travelTimes) {
            addresses = meetingPoint.travelTimes.map((tt, index) => ({
              id: tt.id || index + 1,
              value: tt.address,
              coordinates: null // We don't need coordinates for display
            }));
          }
          
          // Show results and trigger animation
          showResults = true;
          animateToResults = true;
          
          // Clean up URL (remove share parameter)
          const newUrl = new URL(window.location);
          newUrl.searchParams.delete('share');
          window.history.replaceState({}, '', newUrl);
          
        } else {
          error = result.error || 'Failed to load shared meeting point';
        }
      } catch (err) {
        console.error('Error loading shared meeting point:', err);
        error = 'Failed to load shared meeting point';
      } finally {
        isCalculating = false;
      }
    }
  }

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

  async function toggleMapExpanded() {
    mapExpanded = !mapExpanded;
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

  async function startNewSearch() {
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
    mapExpanded = false;
  }

  // Open Google Maps with directions
  function openInGoogleMaps() {
    if (!meetingPoint || !meetingPoint.coordinates) return;
    
    const [lng, lat] = meetingPoint.coordinates;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
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
      <!-- Mobile Status Bar Space -->
      {#if isMobile}
        <div class="flex-shrink-0" style="height: max(20px, env(safe-area-inset-top))"></div>
      {/if}

      <!-- Main Content Area -->
      <div class="flex-1 {isMobile ? 'flex flex-col overflow-hidden' : 'container mx-auto px-4 py-4 max-w-[1600px]'} {isMobile ? '' : 'h-0 flex-1 overflow-hidden'}">
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
            <div class="flex flex-col h-full">
              
              <!-- MAP AT TOP - Priority Position -->
              <div class="flex-shrink-0 {mapExpanded ? 'h-96' : showResults ? 'h-64' : 'h-80'} transition-all duration-300 relative">
                <div class="h-full relative mx-4 mb-4 pb-4">
                  <!-- Map Header with Controls -->
                  <div class="absolute top-3 left-3 right-3 z-20 flex items-center justify-between">
                    <!-- Floating Logo -->
                    <div class="bg-white/95 backdrop-blur-xl rounded-2xl px-4 py-2 shadow-lg border border-white/20">
                      <div class="flex items-center">
                        <span class="text-xl mr-2">📍</span>
                        <div>
                          <h1 class="text-sm font-bold text-gray-800">Voilà!</h1>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Map Controls -->
                    <div class="flex items-center space-x-2">
                                            <!-- User Authentication Button -->
                      {#if $authStore.user}
                        <!-- Profile Button (when logged in) -->
                        <a 
                          href="/profile" 
                          class="mobile-btn-ghost w-10 h-10 bg-white/95 backdrop-blur-xl shadow-lg border border-white/20 rounded-2xl flex items-center justify-center text-gray-700"
                        >
                          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                          </svg>
                        </a>
                      {:else}
                        <!-- Sign In Button (when not logged in) -->
                        <a 
                          href="/auth/login" 
                          class="mobile-btn-ghost px-4 py-2 bg-white/95 backdrop-blur-xl shadow-lg border border-white/20 rounded-2xl text-sm font-medium text-gray-700 flex items-center space-x-2"
                        >
                          <span>Sign In</span>
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                          </svg>
                        </a>
                      {/if}
                      
                      {#if meetingPoint}
                        <button
                          class="mobile-btn-ghost w-10 h-10 rounded-xl bg-white/95 backdrop-blur-xl shadow-lg border border-white/20 flex items-center justify-center"
                          on:click={toggleMapExpanded}
                        >
                          <svg class="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {#if mapExpanded}
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9l6 6m0-6l-6 6"/>
                            {:else}
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
                            {/if}
                          </svg>
                        </button>
                      {/if}
                    </div>
                  </div>

                  <!-- Map Container -->
                  <div class="h-full rounded-2xl overflow-hidden shadow-xl bg-gradient-to-br from-blue-100/80 to-purple-100/80 backdrop-blur-sm border-2 border-blue-200/50">
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

              <!-- CONTENT BELOW MAP -->
              <div class="flex-1 overflow-y-auto pb-20">
                <div class="px-4 space-y-4">

                  <!-- Address Form / Results Section -->
                  <div class="mobile-card-elevated">
                    {#if isCalculating}
                      <!-- Enhanced Mobile Loading State -->
                      <div class="p-6 text-center mobile-fade-in">
                        <div class="relative mb-6">
                          <!-- Animated loading rings -->
                          <div class="w-20 h-20 mx-auto relative">
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
                        
                        <h3 class="text-xl font-bold text-slate-800 mb-3">Finding your perfect spot...</h3>
                        <p class="text-slate-600 mb-6">Analyzing {addresses.length} locations for the best meeting point</p>
                        
                        <!-- Progress indicators -->
                        <div class="space-y-3">
                          <div class="flex items-center justify-center space-x-3 text-sm text-slate-600">
                            <div class="flex items-center">
                              <div class="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                              Calculating optimal routes
                            </div>
                          </div>
                          <div class="flex items-center justify-center space-x-3 text-sm text-slate-600">
                            <div class="flex items-center">
                              <div class="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse" style="animation-delay: 0.5s;"></div>
                              Discovering nearby venues
                            </div>
                          </div>
                          <div class="flex items-center justify-center space-x-3 text-sm text-slate-600">
                            <div class="flex items-center">
                              <div class="w-2 h-2 bg-purple-400 rounded-full mr-2 animate-pulse" style="animation-delay: 1s;"></div>
                              Optimizing travel times
                            </div>
                          </div>
                        </div>
                      </div>
                      
                    {:else if meetingPoint && showResults}
                      <!-- Results Mode -->
                      <div class="p-4">
                        <!-- Condensed Search Summary -->
                        <div class="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 mb-4">
                          <div class="flex items-center">
                            <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-3">
                              <span class="text-white text-sm">🎯</span>
                            </div>
                            <div>
                              <p class="text-sm font-semibold text-green-800">Perfect spot found!</p>
                              <p class="text-xs text-green-600">{addresses.length} locations analyzed</p>
                            </div>
                          </div>
                          <button 
                            class="mobile-btn-ghost text-xs px-3 py-1.5 bg-white/80 text-green-700 border border-green-300 flex items-center space-x-1"
                            on:click={startNewSearch}
                          >
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
                            </svg>
                            <span>New Search</span>
                          </button>
                        </div>
                        
                        <!-- Results -->
                        <MeetingPointDisplay
                          {meetingPoint}
                          {meetingPoints}
                          {currentMeetingPointIndex}
                          {venues}
                          {routes}
                          {isCalculating}
                          showGoogleMaps={true}
                          variant="card"
                          on:venue-selected={(e) => console.log("Venue selected:", e.detail)}
                          on:toggle-results={toggleResults}
                          on:meeting-point-change={handleMeetingPointChange}
                          on:open-google-maps={openInGoogleMaps}
                        />
                      </div>
                      
                    {:else}
                      <!-- Address Input Mode -->
                      <div class="p-4">
                        <!-- Enhanced Header -->
                        <div class="text-center mb-6">
                          <h2 class="text-lg font-bold text-gray-800 mb-2">Where are you meeting from?</h2>
                          <p class="text-sm text-gray-600">Add locations and we'll find the perfect middle ground</p>
                        </div>

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
                  </div>

                  <!-- Onboarding Flow for Non-logged Users -->
                  {#if !$authStore.user && !isCalculating && !showResults}
                    <div class="mt-6 space-y-6">
                      <!-- How It Works Section -->
                      <div class="mobile-card-elevated p-6">                  
                        <!-- Flow Steps - Horizontal Layout -->
                        <div class="flex items-center justify-between space-x-2">
                          <!-- Step 1 -->
                          <div class="flex-1 text-center">
                            <div class="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg mx-auto mb-2">
                              <span class="text-white text-lg">👥</span>
                            </div>
                            <h4 class="font-semibold text-gray-800 text-xs mb-1">Add your friends</h4>
                          </div>
                          
                          <!-- Arrow -->
                          <svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                          </svg>
                          
                          <!-- Step 2 -->
                          <div class="flex-1 text-center">
                            <div class="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg mx-auto mb-2">
                              <span class="text-white text-lg">📱</span>
                            </div>
                            <h4 class="font-semibold text-gray-800 text-xs mb-1">Create groups</h4>
                          </div>
                          
                          <!-- Arrow -->
                          <svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                          </svg>
                          
                          <!-- Step 3 -->
                          <div class="flex-1 text-center">
                            <div class="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg mx-auto mb-2">
                              <span class="text-white text-lg">📍</span>
                            </div>
                            <h4 class="font-semibold text-gray-800 text-xs mb-1">Find the best spots</h4>
                          </div>
                        </div>
                        
                        <!-- Start Button -->
                        <div class="mt-2 pt-4 border-t border-gray-100">
                          <a 
                            href="/auth/register" 
                            class="w-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 text-white py-4 rounded-2xl font-bold text-base flex items-center justify-center space-x-3 shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
                          >
                            <span class="text-xl">🚀</span>
                            <span>Get Started</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          {:else}
            <!-- Desktop Layout (unchanged but enhanced) -->
            <div class="h-full grid grid-cols-12 gap-6">
              
              <!-- Left Sidebar -->
              <div class="col-span-5 flex flex-col h-full min-h-0">
                
                <!-- Glassmorphic Container -->
                <div class="flex flex-col h-full bg-white/80 backdrop-blur-xl rounded-3xl border border-white/40 shadow-[0_20px_50px_0_rgba(8,47,73,0.11)] overflow-hidden">
                  
                  <!-- Enhanced Header Section -->
                  <div class="flex-shrink-0 p-6 relative">
                    <!-- Decorative Elements -->
                    <div class="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-2xl -translate-y-6 translate-x-6"></div>
                    <div class="absolute -top-3 -left-3 w-16 h-16 bg-gradient-to-br from-pink-400/20 to-orange-400/20 rounded-full blur-xl"></div>

                    <div class="relative">
                      <div class="flex items-center mb-4">
                        <div class="relative">
                          <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl transform rotate-3">
                            <span class="text-xl">📍</span>
                          </div>
                          <div class="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                            <span class="text-xs">✨</span>
                          </div>
                        </div>
                        <div class="ml-4">
                          <h1 class="text-2xl font-bold bg-gradient-to-r from-slate-800 via-blue-700 to-purple-700 bg-clip-text text-transparent leading-tight">
                            Voilà!
                          </h1>
                          <p class="text-slate-600 font-medium">
                            Find the perfect meeting spot
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Divider with Gradient -->
                  <div class="flex-shrink-0 h-px bg-gradient-to-r from-transparent via-slate-300/50 to-transparent mx-6"></div>

                  <!-- Address Form Section -->
                  {#if meetingPoint && showResults}
                    <!-- Condensed Address Form when results are shown -->
                    <div class="flex-shrink-0 p-6 py-4">
                      <div class="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4 mobile-fade-in">
                        <div class="flex items-center justify-between">
                          <div class="flex items-center">
                            <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-3">
                              <span class="text-white text-sm">🎯</span>
                            </div>
                            <div>
                              <p class="text-sm font-semibold text-green-800">
                                Perfect spot found for {addresses.length} locations
                              </p>
                              <div class="flex items-center space-x-1 mt-1">
                                {#each addresses.slice(0, 3) as address, i}
                                  <div class="w-2 h-2 rounded-full bg-green-400"></div>
                                {/each}
                                {#if addresses.length > 3}
                                  <span class="text-xs text-green-600">+{addresses.length - 3}</span>
                                {/if}
                              </div>
                            </div>
                          </div>
                          <button 
                            class="btn btn-outline btn-sm text-xs px-4 py-2 bg-white/80 hover:bg-white border-green-300 text-green-700 hover:text-green-800 flex items-center space-x-1"
                            on:click={startNewSearch}
                          >
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
                            </svg>
                            <span>New Search</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  {:else}
                    <!-- Full Address Form when no results -->
                    <div class="flex-shrink-0 p-6 py-4">
                      <div class="text-center mb-6">
                        <h2 class="text-lg font-semibold text-gray-800 mb-2">Where are you meeting from?</h2>
                        <p class="text-sm text-gray-600">Add locations and we'll find the perfect middle ground</p>
                      </div>
                      
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
                  <div class="flex-1 overflow-y-auto p-6 pt-2 scrollbar-thin min-h-0">
                    {#if meetingPoint}
                      <!-- Results Header -->
                      <div class="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/50">
                        <div class="flex items-center">
                          <span class="text-xl mr-3">🎯</span>
                          <h3 class="text-xl font-bold text-secondary-800">Meeting Results</h3>
                        </div>
                        <div class="flex items-center space-x-2">
                          {#if isDebugMode && debugData?.heatmap_data}
                            <button
                              class="btn btn-sm {showHeatmap ? 'btn-primary' : 'btn-outline'} text-xs px-3 py-1.5"
                              on:click={() => showHeatmap = !showHeatmap}
                              title="Toggle POI heatmap - Shows transit hubs, restaurants, and public spaces"
                            >
                              🔥 Heatmap
                            </button>
                            <button
                              class="btn btn-sm {showMovementVectors ? 'btn-primary' : 'btn-outline'} text-xs px-3 py-1.5"
                              on:click={() => showMovementVectors = !showMovementVectors}
                              title="Show candidate movement vectors - How grid points moved toward POI hotspots"
                            >
                              ➡️ Vectors
                            </button>
                          {/if}
                          <div class="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1.5 rounded-full text-xs font-medium shadow-lg">
                            Found
                          </div>
                        </div>
                      </div>
                      
                      <MeetingPointDisplay
                        {meetingPoint}
                        {meetingPoints}
                        {currentMeetingPointIndex}
                        {venues}
                        {routes}
                        {isCalculating}
                        showGoogleMaps={true}
                        variant="full"
                        on:venue-selected={(e) => console.log("Venue selected:", e.detail)}
                        on:toggle-results={toggleResults}
                        on:meeting-point-change={handleMeetingPointChange}
                        on:open-google-maps={openInGoogleMaps}
                      />
                      
                      <!-- Heatmap Info -->
                      {#if isDebugMode && (showHeatmap || showMovementVectors) && debugData?.heatmap_data}
                        <div class="mt-6 p-4 bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-xl">
                          <div class="flex items-center mb-3">
                            <span class="text-lg mr-2">{showHeatmap ? '🔥' : '➡️'}</span>
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
                          <div class="relative bg-gradient-to-br from-green-50 to-blue-50 rounded-2xl p-6 text-center border border-green-200/50 shadow-xl backdrop-blur-sm">
                            <div class="relative mb-4">
                              <svg
                                class="w-16 h-16 mx-auto text-green-500/70 animate-float"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fill-rule="evenodd"
                                  d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                                  clip-rule="evenodd"
                                />
                              </svg>
                              <div class="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-yellow-300 to-orange-400 rounded-full flex items-center justify-center shadow-lg animate-bounce-subtle">
                                <span class="text-sm">✨</span>
                              </div>
                            </div>
                            <h3 class="text-lg font-bold text-green-700 mb-3">
                              Ready to find your perfect spot?
                            </h3>
                            <p class="text-green-600 text-sm mb-4 leading-relaxed">
                              Enter addresses above and we'll find the perfect
                              meeting point with smart venue suggestions.
                            </p>
                            <div class="flex items-center justify-center space-x-4 text-xs text-green-500 mb-4">
                              <div class="flex items-center">
                                <div class="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse"></div>
                                Real-time routing
                              </div>
                              <div class="flex items-center">
                                <div class="w-2 h-2 bg-blue-400 rounded-full mr-1 animate-pulse" style="animation-delay: 0.5s;"></div>
                                Smart venues
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    {/if}
                  </div>
                </div>
              </div>

              <!-- Map Section - Enhanced -->
              <div class="col-span-7 h-full">
                <div class="h-full relative">
                  <!-- Map Container with Enhanced Styling -->
                  <div class="h-full rounded-3xl overflow-hidden shadow-[0_25px_60px_0_rgba(8,47,73,0.15)] border border-white/30 bg-gradient-to-br from-blue-50/40 via-white/60 to-purple-50/40 backdrop-blur-sm">
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

  .mobile-fade-in {
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

  /* Mobile specific styles */
  @media (max-width: 768px) {
    .mobile-card-elevated {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }
  }

  /* Responsive Container Max Width */
  .container {
    max-width: 1600px;
  }
</style>
