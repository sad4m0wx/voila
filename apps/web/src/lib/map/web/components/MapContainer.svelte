<script>
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import { googleMapsService } from '../GoogleMapsService';
    
    // Props
    export let center = [2.3522, 48.8566]; // Default: Paris
    export let apiKey = null;
    export let zoom = 12;
    export let markers = [];
    export let routes = [];
    export let height = '400px';
    export let width = '100%';
    
    // Internal state
    let mapContainer;
    let map = null;
    let mapMarkers = [];
    let mapRoutes = [];
    let isLoaded = false;
    let error = null;
    
    const dispatch = createEventDispatcher();
    
    onMount(async () => {
      let center = [2.3522, 48.8566]; // Default: Paris

      try {
        // Initialize Google Maps
        await googleMapsService.initialize(apiKey);
        
        // Create map
        map = new window.google.maps.Map(mapContainer, {
          center: { lat: center[1], lng: center[0] },
          zoom,
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
        });
        
        // Add markers
        addMarkers();
        
        // Add routes
        addRoutes();
        
        // Listen for bounds change
        map.addListener('bounds_changed', () => {
          const bounds = map.getBounds();
          
          if (bounds) {
            const sw = bounds.getSouthWest();
            const ne = bounds.getNorthEast();
            
            dispatch('bounds', {
              bounds: {
                southwest: [sw.lng(), sw.lat()],
                northeast: [ne.lng(), ne.lat()]
              }
            });
          }
        });
        
        isLoaded = true;
        dispatch('ready', { map });
      } catch (err) {
        console.error('Error initializing map:', err);
        error = err.message;
        dispatch('error', { error: err.message });
      }
    });
    
    onDestroy(() => {
      // Clean up markers and routes
      clearMarkers();
      clearRoutes();
    });
    
    // Watch for marker changes
    $: if (map && markers && isLoaded) {
      clearMarkers();
      addMarkers();
    }
    
    // Watch for route changes
    $: if (map && routes && isLoaded) {
      clearRoutes();
      addRoutes();
    }

    $: if (center && (!Array.isArray(center) || center.length !== 2 || isNaN(center[0]) || isNaN(center[1]))) {
      console.error('Invalid center prop:', center);
    }

    $: if (isNaN(center[1])) {
      console.error('Invalid center :', center);
    }

    
    // Update map center when center prop changes
    $: if (map && center && isLoaded) {
      map.setCenter({ lat: center[1], lng: center[0] });
    }
    
    // Update zoom when zoom prop changes
    $: if (map && zoom !== undefined && isLoaded) {
      map.setZoom(zoom);
    }
    
    function addMarkers() {
      if (!map || !markers || !window.google) return;
      
      mapMarkers = markers.map(marker => {
        const position = { 
          lat: marker.position[1], 
          lng: marker.position[0] 
        };
        
        const mapMarker = new window.google.maps.Marker({
          position,
          map,
          title: marker.title,
          icon: marker.icon
        });
        
        if (marker.info) {
          const infoWindow = new window.google.maps.InfoWindow({
            content: marker.info
          });
          
          mapMarker.addListener('click', () => {
            infoWindow.open(map, mapMarker);
          });
        }
        
        return mapMarker;
      });
    }
    
    function clearMarkers() {
      if (mapMarkers.length) {
        mapMarkers.forEach(marker => marker.setMap(null));
        mapMarkers = [];
      }
    }
    
    function addRoutes() {
      if (!map || !routes || !window.google) return;
      
      mapRoutes = routes.map(route => {
        const path = route.geometry.coordinates.map(coord => ({
          lat: coord[1],
          lng: coord[0]
        }));
        
        const polyline = new window.google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: route.color || '#1a73e8',
          strokeOpacity: 1.0,
          strokeWeight: route.weight || 5,
          map
        });
        
        return polyline;
      });
      
      // Fit bounds if routes are provided
      if (mapRoutes.length > 0 && map) {
        const bounds = new window.google.maps.LatLngBounds();
        
        routes.forEach(route => {
          route.geometry.coordinates.forEach(coord => {
            bounds.extend(new window.google.maps.LatLng(coord[1], coord[0]));
          });
        });
        
        map.fitBounds(bounds);
      }
    }
    
    function clearRoutes() {
      if (mapRoutes.length) {
        mapRoutes.forEach(route => route.setMap(null));
        mapRoutes = [];
      }
    }
  </script>
  
  <div 
    bind:this={mapContainer} 
    style="width: {width}; height: {height}; position: relative;"
  >
    {#if error}
      <div class="map-error">
        <p>Error loading map: {error}</p>
      </div>
    {/if}
    
    {#if !isLoaded && !error}
      <div class="map-loading">
        <p>Loading map...</p>
      </div>
    {/if}
  </div>
  
  <style>
    .map-error {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 0, 0, 0.1);
      color: #d32f2f;
      padding: 1rem;
      text-align: center;
    }
    
    .map-loading {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.05);
      color: #555;
    }
  </style>