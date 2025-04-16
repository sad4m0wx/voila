<!-- src/routes/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import SecureGoogleMapsProvider from '$lib/components/SecureGoogleMapsProvider.svelte';
  import MobileAddressInput from '$lib/components/MobileAddressInput.svelte';
  import MobileGoogleMap from '$lib/components/MobileGoogleMap.svelte';
  import { geocodeAddress } from '$lib/services/googleMapsProxy';
  
  // Import our new API service instead of the client-side implementation
  import { findOptimalMeetingPoint } from '$lib/services/meetingPointApi';
  
  let addresses = [{ id: 1, value: '', coordinates: null }];
  let nextId = 2;
  addresses.push({ id: nextId++, value: '', coordinates: null });
  
  let meetingPoint = null;
  let routes = [];
  let isCalculating = false;
  let error = null;
  let mapsReady = false;
  let calculationProgress = 0; // Track calculation progress
  let progressMessage = '';
  let mapBounds = null; // Track current map bounds
  let mapInstance;
  let showResults = false; // Toggle for mobile
  let mapHeight = 450; // Default map height
  
  // Check if we're on mobile
  $: isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  
  // Reset calculation on screen size change
  let wasAlreadyMobile = false;
  $: {
    if (isMobile !== wasAlreadyMobile) {
      wasAlreadyMobile = isMobile;
      // Reset map height for mobile
      if (isMobile) {
        mapHeight = 300;
      } else {
        mapHeight = 450;
      }
    }
  }
  
  onMount(() => {
    // Listen for resize events
    const handleResize = () => {
      isMobile = window.innerWidth < 768;
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });
  
  function handleMapsReady(event) {
    console.log('Maps ready!');
    mapsReady = true;
    if (event.detail && event.detail.map) {
      mapInstance = event.detail.map;
    }
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
  
  function toggleResults() {
    showResults = !showResults;
  }
  
  async function findMeetingPoint() {
    // Reset state
    error = null;
    isCalculating = true;
    calculationProgress = 0;
    progressMessage = 'Validating addresses...';
    showResults = false;
    
    try {
      // Validate inputs
      if (addresses.some(addr => !addr.value.trim())) {
        throw new Error("All addresses must be filled");
      }
      
      if (!mapsReady) {
        throw new Error("Map is not ready yet. Please wait a moment and try again.");
      }
      
      // Step 1: Geocode any addresses that don't have coordinates yet
      progressMessage = 'Geocoding addresses...';
      calculationProgress = 10;
      
      const addressesToGeocode = addresses.filter(addr => !addr.coordinates && addr.value);
      let geocodeCount = 0;
      
      for (const addr of addressesToGeocode) {
        try {
          console.log(`Geocoding address: ${addr.value}`);
          const result = await geocodeAddress(addr.value);
          updateAddressWithCoordinates(addr.id, result.address, result.coordinates);
          geocodeCount++;
          calculationProgress = 10 + Math.floor((geocodeCount / addressesToGeocode.length) * 20);
        } catch (geocodeError) {
          console.error(`Failed to geocode address: ${addr.value}`, geocodeError);
          throw new Error(`Couldn't find location for: ${addr.value}`);
        }
      }
      
      // Step 2: Find the optimal meeting point using our Rust API
      progressMessage = 'Calculating optimal meeting point...';
      calculationProgress = 30;
      
      // Call our API service instead of the client-side implementation
      const result = await findOptimalMeetingPoint(addresses);
      
      progressMessage = 'Finalizing results...';
      calculationProgress = 90;
      
      // Update the meetingPoint state
      meetingPoint = {
        name: result.name,
        coordinates: result.coordinates,
        travelTimes: result.travelTimes
      };
      
      routes = result.routes || [];
      calculationProgress = 100;
      
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
</script>

<svelte:head>
  <title>Voilà ! | Find a place to meet</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta name="theme-color" content="#6366f1" />
  <link rel="stylesheet" href="src/lib/styles/design-system.css">
</svelte:head>

<main>
  <div class="app-container">
    <header class="app-header">
      <div class="logo-container">
        <span class="logo-pin">📍</span>
        <h1>Voilà !</h1>
      </div>
      <p class="tagline">Find the perfect place to meet with your friends</p>
      <p class="api-indicator">Powered by Rust API</p>
    </header>
    
    <!-- Load Google Maps with a restricted API key -->
    <SecureGoogleMapsProvider
      on:ready={handleMapsReady}
      on:error={handleMapsError}
    >
      <div slot="loading" class="loading-message">
        <p>Loading map services...</p>
      </div>
      
      <div slot="error" let:error class="error-message">
        <p>{error}</p>
        <p>Please refresh the page to try again.</p>
      </div>
      
      {#if mapsReady}
        <div class="card form-container">
          <h2>Enter Addresses</h2>
          
          {#if error}
            <div class="alert alert-error">
              <svg xmlns="http://www.w3.org/2000/svg" class="alert-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          {/if}
          
          <div class="addresses">
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
          
          <div class="actions">
            <button class="btn btn-secondary" on:click={addAddress} aria-label="Add another address">
              <svg xmlns="http://www.w3.org/2000/svg" class="action-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>Add Address</span>
            </button>
            
            <button 
              class="btn btn-primary" 
              on:click={findMeetingPoint} 
              disabled={isCalculating}
              aria-label="Find optimal meeting point"
            >
              {#if isCalculating}
                <span class="loader loader-sm"></span>
                <span>{progressMessage}</span>
              {:else}
                <svg xmlns="http://www.w3.org/2000/svg" class="action-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <span>Find Meeting Point</span>
              {/if}
            </button>
          </div>
          
          {#if isCalculating}
            <div class="progress-container mt-4">
              <div class="progress-bar" style="width: {calculationProgress}%;"></div>
            </div>
            <p class="progress-text text-center">{progressMessage}</p>
          {/if}
        </div>
        
        <div class="map-container" style="height: {mapHeight}px;">
          <MobileGoogleMap 
            meetingPoint={meetingPoint} 
            routes={routes}
            on:bounds={handleMapBounds}
            on:ready={handleMapsReady}
            on:error={handleMapsError}
            bind:this={mapInstance}
            myLocationControl={true}
            gestureHandling="greedy"
          />
          
          {#if isMobile && meetingPoint}
            <button 
              class="results-toggle" 
              class:active={showResults}
              on:click={toggleResults}
              aria-label={showResults ? "Hide results" : "Show results"}
            >
              <span>{showResults ? "Hide Details" : "Show Details"}</span>
              <svg xmlns="http://www.w3.org/2000/svg" class="toggle-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transform: rotate({showResults ? '180deg' : '0deg'})">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          {/if}
        </div>
        
        {#if (!isMobile || showResults) && meetingPoint}
          <div class="card results-container {isMobile ? 'mobile-results' : ''}">
            <div class="results-header">
              <h2 class="results-title">Optimal Meeting Point</h2>
              <div class="meeting-badge badge badge-primary">
                <span class="badge-icon">📍</span>
                <span>{meetingPoint.name}</span>
              </div>
            </div>
            
            <a 
              href={`https://www.google.com/maps/search/?api=1&query=${meetingPoint.coordinates[1]},${meetingPoint.coordinates[0]}`} 
              target="_blank" 
              rel="noopener noreferrer"
              class="maps-link"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="maps-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              Open in Google Maps
            </a>
            
            <h3 class="section-title">Travel Times & Routes</h3>
            <ul class="travel-times">
              {#each meetingPoint.travelTimes as time}
                <li class="travel-item {time.estimated ? 'estimated' : ''}">
                  <div class="travel-info">
                    <div class="address-details">
                      <span class="address">{time.address}</span>
                      {#if time.transitSummary}
                        <span class="transit-summary">{@html time.transitSummary}</span>
                      {/if}
                    </div>
                    <div class="time-badge badge {time.estimated ? 'badge-warning' : 'badge-accent'}">
                      <svg xmlns="http://www.w3.org/2000/svg" class="time-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      <span>
                        {time.duration} min
                        {#if time.estimated}
                          <span class="estimated-marker">(est.)</span>
                        {/if}
                      </span>
                    </div>
                  </div>
                </li>
              {/each}
            </ul>
            
            <div class="future-feature">
              <div class="feature-header">
                <svg xmlns="http://www.w3.org/2000/svg" class="feature-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                  <line x1="7" y1="7" x2="7.01" y2="7"></line>
                </svg>
                <h3 class="feature-title">Coming Soon</h3>
              </div>
              <p class="feature-text">Nearby bars and restaurants at this location</p>
            </div>
            
          </div>
        {/if}
      {:else}
        <div class="loading-state">
          <div class="loader loader-lg"></div>
          <p>Initializing map services...</p>
        </div>
      {/if}
    </SecureGoogleMapsProvider>
    
    <footer class="app-footer">
      <p>© {new Date().getFullYear()} Voilà !</p>
    </footer>
  </div>
</main>

<style>
  /* Base app container styles */
  .app-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: var(--space-4) var(--space-4);
  }
  
  /* Header styles */
  .app-header {
    text-align: center;
    margin-bottom: var(--space-8);
  }
  
  .logo-container {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: var(--space-2);
    gap: var(--space-2);
  }
  
  .logo-pin {
    font-size: 2rem;
    animation: bounce 2s infinite;
  }
  
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  
  h1 {
    color: var(--primary-700);
    font-size: var(--text-3xl);
    margin: 0;
  }
  
  .tagline {
    color: var(--text-secondary);
    font-size: var(--text-lg);
    margin: 0;
  }
  
  .api-indicator {
    display: inline-block;
    margin-top: var(--space-2);
    padding: var(--space-1) var(--space-3);
    background-color: var(--accent-100);
    color: var(--accent-700);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
  }
  
  /* Form container */
  .form-container {
    margin-bottom: var(--space-6);
    background-color: var(--bg-card);
  }

  /* Base app container styles */
  .app-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: var(--space-4) var(--space-4);
  }
  
  /* Header styles */
  .app-header {
    text-align: center;
    margin-bottom: var(--space-8);
  }
  
  .logo-container {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: var(--space-2);
    gap: var(--space-2);
  }
  
  .logo-pin {
    font-size: 2rem;
    animation: bounce 2s infinite;
  }
  
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  
  h1 {
    color: var(--primary-700);
    font-size: var(--text-3xl);
    margin: 0;
  }
  
  .tagline {
    color: var(--text-secondary);
    font-size: var(--text-lg);
    margin: 0;
  }
  
  /* Form container */
  .form-container {
    margin-bottom: var(--space-6);
    background-color: var(--bg-card);
  }
  
  .form-container h2 {
    color: var(--text-primary);
    font-size: var(--text-2xl);
    margin-bottom: var(--space-6);
  }
  
  .addresses {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
  }
  
  .actions {
    display: flex;
    justify-content: space-between;
    gap: var(--space-4);
    margin-top: var(--space-6);
  }
  
  .action-icon {
    width: var(--space-5);
    height: var(--space-5);
  }
  
  /* Alert styling */
  .alert {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
  }
  
  .alert-icon {
    width: var(--space-5);
    height: var(--space-5);
    flex-shrink: 0;
  }
  
  /* Progress bar */
  .progress-text {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin-top: var(--space-2);
  }
  
  /* Map container */
  .map-container {
    width: 100%;
    position: relative;
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-lg);
    margin-bottom: var(--space-6);
    transition: height 0.3s ease;
  }
  
  /* Results toggle button */
  .results-toggle {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: rgba(255, 255, 255, 0.95);
    border: none;
    border-top: 1px solid var(--neutral-200);
    padding: var(--space-3) var(--space-4);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    font-weight: var(--font-medium);
    color: var(--primary-600);
    cursor: pointer;
    transition: all var(--transition-normal);
    box-shadow: 0 -2px 5px rgba(0, 0, 0, 0.05);
  }
  
  .results-toggle.active {
    background-color: white;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
  }
  
  .toggle-icon {
    transition: transform var(--transition-normal);
  }
  
  /* Results container */
  .results-container {
    background-color: var(--bg-card);
  }
  
  .mobile-results {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    margin-top: -1rem;
    position: relative;
    z-index: 10;
  }
  
  .results-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }
  
  .results-title {
    color: var(--text-primary);
    font-size: var(--text-2xl);
    margin: 0;
  }
  
  .meeting-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    margin-bottom: var(--space-4);
  }
  
  .badge-icon {
    display: inline-block;
    margin-right: var(--space-1);
  }
  
  .maps-link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    background-color: var(--primary-50);
    color: var(--primary-700);
    border-radius: var(--radius-md);
    font-weight: var(--font-medium);
    text-decoration: none;
    margin-bottom: var(--space-6);
    transition: all var(--transition-fast);
  }
  
  .maps-link:hover {
    background-color: var(--primary-100);
  }
  
  .maps-icon {
    color: var(--primary-500);
  }
  
  .section-title {
    font-size: var(--text-lg);
    color: var(--text-primary);
    margin-top: var(--space-6);
    margin-bottom: var(--space-4);
    padding-bottom: var(--space-2);
    border-bottom: 1px solid var(--neutral-200);
  }
  
  /* Travel times list */
  .travel-times {
    list-style: none;
    padding: 0;
    margin: 0 0 var(--space-6) 0;
  }
  
  .travel-item {
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--neutral-100);
  }
  
  .travel-item:last-child {
    border-bottom: none;
  }
  
  .travel-info {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-4);
  }
  
  .address-details {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    flex: 1;
  }
  
  .address {
    font-weight: var(--font-medium);
    color: var(--text-primary);
  }
  
  .transit-summary {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    line-height: 1.4;
  }
  
  .time-badge {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    white-space: nowrap;
  }
  
  .time-icon {
    width: var(--space-4);
    height: var(--space-4);
  }
  
  .estimated-marker {
    font-weight: var(--font-normal);
    font-style: italic;
    font-size: 0.7rem;
  }
  
  .estimated .transit-summary {
    color: var(--neutral-400);
  }
  
  /* Future feature section */
  .future-feature {
    background-color: var(--bg-subtle);
    padding: var(--space-4);
    border-radius: var(--radius-md);
    margin-top: var(--space-6);
  }
  
  .feature-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }
  
  .feature-icon {
    color: var(--accent-500);
  }
  
  .feature-title {
    font-size: var(--text-lg);
    color: var(--text-primary);
    margin: 0;
  }
  
  .feature-text {
    color: var(--text-secondary);
    margin: 0;
  }
  
  /* Cache control */
  .cache-control {
    margin-top: var(--space-6);
    text-align: center;
  }
  
  .cache-icon {
    width: var(--space-4);
    height: var(--space-4);
  }
  
  /* Loading and error states */
  .loading-state,
 
  
  /* Footer */
  .app-footer {
    margin-top: var(--space-10);
    padding: var(--space-6) 0;
    text-align: center;
    color: var(--text-tertiary);
    border-top: 1px solid var(--neutral-200);
  }
  
  .app-footer p {
    margin: var(--space-1) 0;
    font-size: var(--text-sm);
  }
  
  .footer-attribution {
    color: var(--primary-500);
  }
  
  /* Responsive styles */
  @media (max-width: 768px) {
    .app-container {
      padding: var(--space-4) var(--space-2);
    }
    
    .logo-pin {
      font-size: 1.5rem;
    }
    
    h1 {
      font-size: var(--text-2xl);
    }
    
    .tagline {
      font-size: var(--text-base);
    }
    
    .form-container {
      padding: var(--space-4);
      margin-bottom: var(--space-4);
    }
    
    .form-container h2 {
      font-size: var(--text-xl);
      margin-bottom: var(--space-4);
    }
    
    .actions {
      flex-direction: column;
      margin-top: var(--space-4);
    }
    
    .actions button {
      width: 100%;
    }
    
    .travel-info {
      flex-direction: column;
      gap: var(--space-2);
    }
    
    .maps-link {
      display: flex;
      width: 100%;
      justify-content: center;
    }
    
    .section-title {
      font-size: var(--text-base);
      margin-top: var(--space-4);
    }
    
    .results-container {
      padding: var(--space-4);
    }
    
    .results-title {
      font-size: var(--text-xl);
    }
  }
</style>