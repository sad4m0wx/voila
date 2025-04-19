<!-- src/lib/components/MobileGoogleMap.svelte -->
<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { isGoogleMapsLoaded, waitForGoogleMaps } from '$lib/services/googleMapsProxy';
  import { defaultMapCenter, defaultMapZoom } from '$lib/config.js'

  export let initialCenter = defaultMapCenter;
  export let initialZoom = defaultMapZoom;
  export let meetingPoint = null;
  export let routes = [];
  export let fullscreenControl = true;
  export let gestureHandling = 'greedy'; // Better for mobile touch
  export let myLocationControl = true; // "My location" button
  
  const dispatch = createEventDispatcher();
  let mapContainer;
  let map;
  let markers = [];
  let directionsRenderers = [];
  let isMapInitialized = false;
  let currentBounds = null;
  let myLocationControlAdded = false;
  let mapInitError = null;
  
  onMount(async () => {
    try {
      // Explicitly wait for Google Maps to load
      await waitForGoogleMaps(15000); // 15-second timeout
      
      // Now initialize the map
      if (isGoogleMapsLoaded()) {
        console.log('Google Maps loaded, initializing map');
        initializeMap();
      } else {
        console.error('Google Maps not available after waiting');
        mapInitError = 'Could not load map services. Please refresh the page.';
        dispatch('error', { message: mapInitError });
      }
    } catch (error) {
      console.error('Error loading Google Maps:', error);
      mapInitError = error.message || 'Could not load map services. Please refresh the page.';
      dispatch('error', { message: mapInitError });
    }
    
    return () => {
      // Clean up markers
      if (markers && markers.length) {
        markers.forEach(marker => {
          if (marker && marker.setMap) marker.setMap(null);
        });
      }
      
      // Clean up directions renderers
      if (directionsRenderers && directionsRenderers.length) {
        directionsRenderers.forEach(renderer => {
          if (renderer && renderer.setMap) renderer.setMap(null);
        });
      }
    };
  });
  
  // Watch for changes to meetingPoint and routes
  $: if (isMapInitialized && meetingPoint) {
    updateMeetingPoint(meetingPoint);
  }
  
  $: if (isMapInitialized && routes && routes.length > 0) {
    updateRoutes(routes);
  }
  
  function initializeMap() {
    try {
      if (!window.google || !window.google.maps) {
        throw new Error('Google Maps not available');
      }
      
      // Create the map with mobile-friendly options
      map = new google.maps.Map(mapContainer, {
        center: initialCenter,
        zoom: initialZoom,
        mapTypeControl: false, // Hide map type control on mobile to save space
        streetViewControl: false,
        fullscreenControl,
        zoomControl: true,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        gestureHandling, // 'greedy' allows one finger to pan the map
        zoomControlOptions: {
          position: google.maps.ControlPosition.RIGHT_TOP
        }
      });
      
      // Add "my location" button if requested
      if (myLocationControl) {
        addMyLocationControl();
      }
      
      // Listen for bounds changes and dispatch them
      map.addListener('idle', () => {
        const bounds = map.getBounds();
        if (bounds) {
          const ne = bounds.getNorthEast();
          const sw = bounds.getSouthWest();
          
          currentBounds = {
            north: ne.lat(),
            east: ne.lng(),
            south: sw.lat(),
            west: sw.lng()
          };
          
          dispatch('bounds', { bounds: currentBounds });
        }
      });
      
      isMapInitialized = true;
      dispatch('ready', { map });
      console.log('Map initialized successfully');
    } catch (error) {
      console.error('Error initializing map:', error);
      mapInitError = error.message || 'Failed to initialize map';
      dispatch('error', { message: mapInitError });
    }
  }
  
  function addMyLocationControl() {
    if (!map || myLocationControlAdded) return;
    
    try {
      // Create a custom control div
      const locationButton = document.createElement('button');
      locationButton.className = 'custom-map-control-button';
      locationButton.innerHTML = '<span class="location-icon"></span>';
      locationButton.title = 'My Location';
      locationButton.setAttribute('aria-label', 'Show my location');
      
      // Add control to the map
      map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(locationButton);
      
      // Add click handler
      locationButton.addEventListener('click', () => {
        // Try to get user's location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              };
              
              // Add a marker at user's location
              const userMarker = new google.maps.Marker({
                position: pos,
                map,
                title: "Your Location",
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: '#4285F4',
                  fillOpacity: 1,
                  strokeColor: '#FFFFFF',
                  strokeWeight: 2
                }
              });
              
              markers.push(userMarker);
              
              // Add a blue circle to show accuracy
              const accuracyCircle = new google.maps.Circle({
                map,
                center: pos,
                radius: position.coords.accuracy,
                fillColor: '#4285F4',
                fillOpacity: 0.15,
                strokeColor: '#4285F4',
                strokeOpacity: 0.5,
                strokeWeight: 1
              });
              
              // Store the circle as a kind of marker for later cleanup
              markers.push(accuracyCircle);
              
              // Pan to the position
              map.panTo(pos);
              map.setZoom(15);
              
              // Dispatch the user location event
              dispatch('userlocation', { position: pos });
            },
            (error) => {
              console.error('Error getting user location:', error);
              locationButton.disabled = true;
              locationButton.style.opacity = 0.5;
              
              // Create an info window with the error
              const infoWindow = new google.maps.InfoWindow({
                content: "Error getting your location. Please check your browser settings.",
                position: map.getCenter()
              });
              
              infoWindow.open(map);
              setTimeout(() => infoWindow.close(), 5000);
            }
          );
        } else {
          console.error('Browser does not support geolocation');
          locationButton.disabled = true;
          locationButton.style.opacity = 0.5;
        }
      });
      
      // Add styles for the button
      const style = document.createElement('style');
      style.textContent = `
        .custom-map-control-button {
          background-color: #fff;
          border: 0;
          border-radius: 2px;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
          margin: 10px;
          padding: 0;
          width: 40px;
          height: 40px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .location-icon {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid #4285F4;
          background-color: white;
          position: relative;
        }
        
        .location-icon:before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 8px;
          height: 8px;
          background-color: #4285F4;
          border-radius: 50%;
          transform: translate(-50%, -50%);
        }
      `;
      document.head.appendChild(style);
      
      myLocationControlAdded = true;
    } catch (error) {
      console.error('Error adding my location control:', error);
    }
  }
  
  function clearMarkers() {
    if (!markers) return;
    
    markers.forEach(marker => {
      if (marker && marker.setMap) marker.setMap(null);
    });
    markers = [];
  }
  
  function clearRoutes() {
    if (!directionsRenderers) return;
    
    directionsRenderers.forEach(renderer => {
      if (renderer && renderer.setMap) renderer.setMap(null);
    });
    directionsRenderers = [];
  }
  
  function updateMeetingPoint(point) {
    if (!map || !point || !point.coordinates) return;
    
    clearMarkers();
    
    // Convert coordinates [lng, lat] to Google's {lat, lng} format
    const position = {
      lat: point.coordinates[1],
      lng: point.coordinates[0]
    };
    
    // Center the map on the meeting point
    map.setCenter(position);
    map.setZoom(14);
    
    // Add a marker for the meeting point
    const marker = new google.maps.Marker({
      position,
      map,
      title: point.name,
      animation: google.maps.Animation.DROP,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#FF0000',
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#FFFFFF'
      }
    });
    
    // Add info window
    const infoWindow = new google.maps.InfoWindow({
      content: `<div><h3 style="margin:0;padding:5px 0;font-size:16px;">${point.name}</h3></div>`
    });
    
    marker.addListener('click', () => {
      infoWindow.open(map, marker);
    });
    
    markers.push(marker);
  }
  
  function updateRoutes(routeData) {
    if (!map || !routeData) return;
    
    clearRoutes();
    
    // Routes come in as GeoJSON LineString format, convert to Google Maps format
    routeData.forEach((route, index) => {
      if (!route.geometry || !route.geometry.coordinates) return;
      
      const path = route.geometry.coordinates.map(coord => ({
        lat: coord[1],
        lng: coord[0]
      }));
      
      const polyline = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: getRouteColor(index),
        strokeOpacity: 0.8,
        strokeWeight: 4
      });
      
      polyline.setMap(map);
      directionsRenderers.push(polyline);
    });
  }
  
  // Generate different colors for different routes
  function getRouteColor(index) {
    const colors = [
      '#4285F4', // Blue
      '#EA4335', // Red
      '#FBBC05', // Yellow
      '#34A853', // Green
      '#8F00FF', // Purple
      '#FF6D01', // Orange
      '#01DFFF', // Cyan
      '#FF00FF'  // Magenta
    ];
    
    return colors[index % colors.length];
  }
  
  // Method to get current bounds (can be called from parent)
  export function getBounds() {
    return currentBounds;
  }
  
  // Method to center on user's location
  export function centerOnUserLocation() {
    if (!map) return;
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          
          map.panTo(pos);
          map.setZoom(15);
          
          dispatch('userlocation', { position: pos });
        },
        (error) => {
          console.error('Error getting user location:', error);
        }
      );
    }
  }
</script>

<div class="map-container">
  {#if mapInitError}
    <div class="map-error">
      <svg xmlns="http://www.w3.org/2000/svg" class="error-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <p>{mapInitError}</p>
      <button class="retry-button" on:click={() => window.location.reload()}>
        Reload Page
      </button>
    </div>
  {:else}
    <div class="map-element" bind:this={mapContainer}></div>
  {/if}
</div>

<style>
  .map-container {
    width: 100%;
    height: 100%;
    border-radius: 8px;
    overflow: hidden;
    position: relative;
  }
  
  .map-element {
    width: 100%;
    height: 100%;
  }
  
  .map-error {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: #f8f8f8;
    color: #d32f2f;
    padding: 1rem;
    text-align: center;
  }
  
  .error-icon {
    margin-bottom: 1rem;
    color: #d32f2f;
  }
  
  .retry-button {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background-color: #4a80f5;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  @media (max-width: 768px) {
    .map-container {
      border-radius: 4px;
    }
  }
</style>