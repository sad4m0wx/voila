<script>
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import { googleMapsService } from '$services/map';
    
    // Props
    export let center = [2.3522, 48.8566]; // Default: Paris
    export let apiKey = null;
    export let zoom = 12;
    export let markers = [];
    export let routes = [];
    export let polygons = []; // Debug polygons (isochrones, intersections)
    export let meetingZoneRadius = 0; // Radius in meters for the meeting zone circle
    export let height = '400px';
    export let width = '100%';
    export let animateToResults = false; // Flag to trigger animation to results
    export let zoomToFitMarkers = false; // Flag to control auto-zooming to all markers
    
    // Internal state
    let mapContainer;
    let map = null;
    let mapMarkers = [];
    let mapRoutes = [];
    let mapPolygons = [];
    let meetingZoneCircle = null;
    let isLoaded = false;
    let error = null;
    let allMarkersBounds = null;
    let zoomAnimation = null; // To track and cancel zoom animation
    let userInteracted = false; // Flag to detect user interaction
    
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
          gestureHandling: 'greedy', // Allow one-finger panning on mobile
        });
        
        // Add listeners for user interaction to cancel animations
        map.addListener('dragstart', () => {
          userInteracted = true;
          // Cancel any ongoing zoom animation
          if (zoomAnimation) {
            clearTimeout(zoomAnimation);
            zoomAnimation = null;
          }
        });
        
        map.addListener('zoom_changed', () => {
          // If the user manually zooms, cancel animations
          if (!zoomAnimation) {
            userInteracted = true;
          }
        });
        
        // Add markers
        addMarkers();
        
        // Add routes
        addRoutes();
        
        // Add polygons
        addPolygons();
        
        // Add meeting zone circle if radius provided
        if (meetingZoneRadius > 0) {
          addMeetingZoneCircle();
        }
        
        // Initial view to show all markers
        fitMapToAllMarkers();
        
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
      // Clean up markers, routes, polygons, and circle
      clearMarkers();
      clearRoutes();
      clearPolygons();
      clearMeetingZoneCircle();
    });
    
    // Watch for marker changes
    $: if (map && markers && isLoaded) {
      clearMarkers();
      addMarkers();
      // Update bounds to fit all markers
      fitMapToAllMarkers();
    }
    
    // Watch for route changes
    $: if (map && routes && isLoaded) {
      clearRoutes();
      addRoutes();
    }
    
    // Watch for polygon changes
    $: if (map && polygons && isLoaded) {
      clearPolygons();
      addPolygons();
    }
    
    // Watch for animation flag
    $: if (map && isLoaded && animateToResults && center && meetingZoneRadius > 0) {
      animateToMeetingPoint();
    }
    
    // Watch for meeting zone radius changes
    $: if (map && isLoaded && center && meetingZoneRadius !== undefined) {
      clearMeetingZoneCircle();
      if (meetingZoneRadius > 0) {
        addMeetingZoneCircle();
      }
    }

    $: if (center && (!Array.isArray(center) || center.length !== 2 || isNaN(center[0]) || isNaN(center[1]))) {
      console.error('Invalid center prop:', center);
    }

    // Update map center when center prop changes (but don't override animations)
    $: if (map && center && isLoaded && !animateToResults) {
      map.setCenter({ lat: center[1], lng: center[0] });
      // Update circle position if it exists
      if (meetingZoneCircle) {
        meetingZoneCircle.setCenter({ lat: center[1], lng: center[0] });
      }
    }
    
    // Update zoom when zoom prop changes (but don't override animations)
    $: if (map && zoom !== undefined && isLoaded && !animateToResults) {
      map.setZoom(zoom);
    }
    
    // Fit map to show all address markers
    function fitMapToAllMarkers() {
      if (!map || !markers || markers.length === 0) return;
      
      const bounds = new window.google.maps.LatLngBounds();
      let hasValidMarkers = false;
      
      // Only use address markers (not meeting point or venues)
      markers.forEach(marker => {
        if (marker.position && Array.isArray(marker.position) && 
            marker.position.length === 2 && 
            !isNaN(marker.position[0]) && !isNaN(marker.position[1])) {
          bounds.extend(new window.google.maps.LatLng(marker.position[1], marker.position[0]));
          hasValidMarkers = true;
        }
      });
      
      if (hasValidMarkers) {
        // Store the bounds for later use
        allMarkersBounds = bounds;
        
        // Only fit bounds if zoomToFitMarkers is true and we're not animating to results
        if (zoomToFitMarkers && !animateToResults && !meetingZoneRadius) {
          map.fitBounds(bounds, { padding: 50 });
        }
      }
    }
    
    // Animate to meeting point when results are available
    function animateToMeetingPoint() {
      if (!map || !center || center.length !== 2) return;
      
      // Calculate appropriate zoom based on meeting zone radius
      let targetZoom = 15; // Default zoom
      if (meetingZoneRadius > 1000) targetZoom = 13;
      else if (meetingZoneRadius > 500) targetZoom = 14;
      else if (meetingZoneRadius <= 200) targetZoom = 16;
      
      // Smooth animation
      map.panTo({ lat: center[1], lng: center[0] });
      smoothZoom(map, targetZoom, map.getZoom());
    }
    
    // Smooth zoom animation
    function smoothZoom(map, targetZoom, currentZoom) {
      // Clear any existing animation timeout
      if (zoomAnimation) {
        clearTimeout(zoomAnimation);
        zoomAnimation = null;
      }
      
      // Stop animation if user has interacted with the map
      if (userInteracted) {
        userInteracted = false; // Reset for next animation
        return;
      }
      
      if (currentZoom != targetZoom) {
        const factor = 0.5;
        const z = currentZoom + factor * (targetZoom - currentZoom);
        
        zoomAnimation = window.setTimeout(() => {
          map.setZoom(z);
          smoothZoom(map, targetZoom, z);
        }, 200);
      } else {
        zoomAnimation = null; // Animation complete
      }
    }
    
    // Enhanced SVG creation functions for modern markers
    function createLocationSvg(number = 1) {
      // Simplified color palette - clean and modern
      const colors = [
        '#3B82F6', // Blue
        '#F59E0B', // Amber  
        '#8B5CF6', // Violet
        '#10B981', // Emerald
        '#EF4444'  // Red
      ];
      const color = colors[(Math.max(1, number) - 1) % colors.length];
      
      return `<svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="drop-shadow-${number}">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.25)"/>
          </filter>
        </defs>
        <!-- Pin shape inspired by logo -->
        <path d="M16 4C10.477 4 6 8.477 6 14c0 8 10 20 10 20s10-12 10-20c0-5.523-4.477-10-10-10z" 
              fill="${color}" 
              filter="url(#drop-shadow-${number})" 
              stroke="white" 
              stroke-width="2"/>
        <!-- Clean white circle for number -->
        <circle cx="16" cy="14" r="8" fill="white"/>
        <!-- Number -->
        <text x="16" y="18" font-family="system-ui, -apple-system, sans-serif" 
              font-size="11" font-weight="600" text-anchor="middle" fill="${color}">${number}</text>
      </svg>`;
    }
    
    function createMeetingPointSvg() {
      return `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="drop-shadow-meeting">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.4)"/>
          </filter>
        </defs>
        <!-- Just the pin emoji -->
        <text x="16" y="24" font-size="24" text-anchor="middle" filter="url(#drop-shadow-meeting)">📍</text>
      </svg>`;
    }
    
    function createVenueSvg() {
      return `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="drop-shadow-venue">
            <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="rgba(0,0,0,0.2)"/>
          </filter>
        </defs>
        <!-- Simple circle -->
        <circle cx="14" cy="14" r="12" fill="#10B981" 
                filter="url(#drop-shadow-venue)" stroke="white" stroke-width="2"/>
        <!-- Restaurant icon - simplified -->
        <circle cx="14" cy="14" r="8" fill="white"/>
        <circle cx="11" cy="12" r="1.5" fill="#10B981"/>
        <circle cx="17" cy="12" r="1.5" fill="#10B981"/>
        <path d="M10 16 Q14 18 18 16" stroke="#10B981" stroke-width="2" fill="none" stroke-linecap="round"/>
      </svg>`;
    }
    
    function addMarkers() {
      if (!map || !markers || !window.google) return;
      
      // Check if we're on mobile
      const isMobile = typeof window !== 'undefined' && 
        (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768);
      
      mapMarkers = markers.map(marker => {
        // Skip invalid markers
        if (!marker.position || !Array.isArray(marker.position) || marker.position.length < 2) {
          console.error('Invalid marker position:', marker.position);
          return null;
        }
        
        if (isNaN(marker.position[0]) || isNaN(marker.position[1])) {
          console.error('Invalid marker coordinates:', marker.position);
          return null;
        }
        
        const position = { 
          lat: marker.position[1], 
          lng: marker.position[0] 
        };
        
        // Create simple SVG based on marker type
        let svg;
        let width, height;
        
        // Apply mobile scaling factor
        const scale = isMobile ? 1.2 : 1;
        
        try {
          if (marker.type === 'meeting-point') {
            svg = createMeetingPointSvg();
            width = 32 * scale;
            height = 32 * scale;
          } else if (marker.type === 'venue') {
            svg = createVenueSvg();
            width = 28 * scale;
            height = 28 * scale;
          } else {
            // Default: location marker
            const number = marker.number || 1;
            svg = createLocationSvg(number);
            width = 32 * scale;
            height = 40 * scale;
          }
          
          // Create blob from SVG
          const blob = new Blob([svg], { type: 'image/svg+xml' });
          const url = URL.createObjectURL(blob);
          
          // Create marker
          const mapMarker = new window.google.maps.Marker({
            position,
            map,
            title: marker.title || '',
            icon: {
              url: url,
              scaledSize: new window.google.maps.Size(width, height),
              anchor: marker.type === 'meeting-point' 
                ? new window.google.maps.Point(width / 2, height - 2) // Pin bottom at location
                : new window.google.maps.Point(width / 2, height), // Default anchor
              zIndex: 999
            },
            optimized: false,
            clickable: Boolean(marker.info),
            zIndex: 999,
            animation: window.google.maps.Animation.DROP
          });
          
          // Store URL for cleanup
          mapMarker.customUrl = url;
          
          // Add info window if info provided
          if (marker.info) {
            const infoWindow = new window.google.maps.InfoWindow({
              content: marker.info,
              maxWidth: isMobile ? 200 : 300
            });
            
            mapMarker.addListener('click', () => {
              infoWindow.open(map, mapMarker);
            });
          }
          
          return mapMarker;
        } catch (error) {
          console.error('Error creating marker:', error);
          return null;
        }
      }).filter(marker => marker !== null);
    }
    
    function clearMarkers() {
      if (mapMarkers.length) {
        mapMarkers.forEach(marker => {
          if (marker) {
            // Clean up URL objects to prevent memory leaks
            if (marker.customUrl) {
              URL.revokeObjectURL(marker.customUrl);
            }
            marker.setMap(null);
          }
        });
        mapMarkers = [];
      }
    }
    
    function addMeetingZoneCircle() {
      if (!map || !window.google || !center || meetingZoneRadius <= 0) return;
      
      meetingZoneCircle = new window.google.maps.Circle({
        center: { lat: center[1], lng: center[0] },
        radius: meetingZoneRadius,
        strokeColor: '#3B82F6',
        strokeOpacity: 0.8,
        strokeWeight: 3,
        fillColor: '#3B82F6',
        fillOpacity: 0.12,
        map,
        clickable: false,
        zIndex: 1
      });
    }
    
    function clearMeetingZoneCircle() {
      if (meetingZoneCircle) {
        meetingZoneCircle.setMap(null);
        meetingZoneCircle = null;
      }
    }
    
    function addRoutes() {
      if (!map || !routes || !window.google) return;
      
      // Create a bounds object to fit all routes
      const bounds = new window.google.maps.LatLngBounds();
      
      mapRoutes = [];
      
      // Process each route
      routes.forEach(route => {
        // First validate the main route geometry
        if (!route.geometry || !route.geometry.coordinates || !Array.isArray(route.geometry.coordinates)) {
          console.error('Invalid route geometry:', route.geometry);
          return;
        }
        
        // For each step in the route, create a separate polyline with detailed path
        if (route.steps && Array.isArray(route.steps)) {
          route.steps.forEach((step, stepIndex) => {
            if (!step.geometry || !step.geometry.coordinates || !Array.isArray(step.geometry.coordinates)) {
              console.log(`Step ${stepIndex} has invalid geometry:`, step.geometry);
              return;
            }
            
            const stepCoords = step.geometry.coordinates;
            if (stepCoords.length < 2) {
              console.log(`Step ${stepIndex} doesn't have enough coordinates`);
              return;
            }
            
            // Create path from the step's detailed coordinates
            const path = stepCoords.map(coord => {
              if (!Array.isArray(coord) || coord.length < 2) return null;
              
              // Add to bounds
              bounds.extend(new window.google.maps.LatLng(coord[1], coord[0]));
              
              return {
                lat: coord[1],
                lng: coord[0]
              };
            }).filter(point => point !== null);
            
            if (path.length < 2) {
              console.log(`Step ${stepIndex} path has too few valid points`);
              return;
            }
            
            // Determine color based on step type
            let stepColor = route.color || '#6366F1'; // Indigo instead of blue
            let strokeWeight = route.weight || 5; // Keep original weight
            
            if (step.mode === 'walking') {
              stepColor = '#059669'; // Darker emerald for walking
            } else if (step.mode === 'transit') {
              stepColor = step.transit_details?.line?.color || '#7C3AED'; // Purple for transit
            } else if (step.mode === 'driving') {
              stepColor = '#2563EB'; // Darker blue for driving
            }
            
            const polyline = new window.google.maps.Polyline({
              path,
              geodesic: true,
              strokeColor: stepColor,
              strokeOpacity: 0.8,
              strokeWeight: strokeWeight,
              map
            });
            
            mapRoutes.push(polyline);
          });
        } else {
          // Fallback to using the main route geometry if steps are not available
          console.log('No steps available, using main route geometry');
          
          const validCoordinates = route.geometry.coordinates.filter(
            coord => Array.isArray(coord) && coord.length >= 2 && !isNaN(coord[0]) && !isNaN(coord[1])
          );
          
          if (validCoordinates.length < 2) {
            console.error('Not enough valid coordinates in route');
            return;
          }
          
          const path = validCoordinates.map(coord => {
            // Add to bounds
            bounds.extend(new window.google.maps.LatLng(coord[1], coord[0]));
            
            return {
              lat: coord[1],
              lng: coord[0]
            };
          });
          
          const polyline = new window.google.maps.Polyline({
            path,
            geodesic: true,
            strokeColor: route.color || '#6366F1',
            strokeOpacity: 0.8,
            strokeWeight: route.weight || 5,
            map
          });
          
          mapRoutes.push(polyline);
        }
      });
      
      // Fit map to route bounds if we have routes
      if (mapRoutes.length > 0) {
        map.fitBounds(bounds);
      }
    }
    
    function clearRoutes() {
      if (mapRoutes.length) {
        mapRoutes.forEach(route => route && route.setMap(null));
        mapRoutes = [];
      }
    }
    
    function addPolygons() {
      return; // TODO: enable?
      if (!map || !polygons || !window.google) return;
      
      mapPolygons = polygons.map(polygon => {
        if (!polygon.coordinates || !Array.isArray(polygon.coordinates)) {
          console.error('Invalid polygon coordinates:', polygon);
          return null;
        }
        
        // Convert coordinates to Google Maps format
        const paths = polygon.coordinates.map(ring => {
          if (!Array.isArray(ring)) return [];
          return ring.map(coord => {
            if (!Array.isArray(coord) || coord.length < 2) return null;
            return { lat: coord[1], lng: coord[0] };
          }).filter(point => point !== null);
        }).filter(ring => ring.length > 0);
        
        if (paths.length === 0) {
          console.error('No valid paths for polygon:', polygon);
          return null;
        }
        
        // Determine colors based on polygon type
        let fillColor = '#3B82F6';
        let strokeColor = '#1E40AF';
        let fillOpacity = 0.2;
        let strokeOpacity = 0.8;
        
        if (polygon.type === 'isochrone') {
          fillColor = '#fff'; // Purple for isochrones
          strokeColor = '#7C3AED';
        } else if (polygon.type === 'intersection') {
          fillColor = '#10B981'; // Green for intersections
          strokeColor = '#059669';
          fillOpacity = 1; // More visible for intersections
        }
        
        const googlePolygon = new window.google.maps.Polygon({
          paths: paths,
          strokeColor: strokeColor,
          strokeOpacity: strokeOpacity,
          strokeWeight: 2,
          fillColor: fillColor,
          fillOpacity: fillOpacity,
          map: map,
          clickable: false,
          zIndex: polygon.type === 'intersection' ? 2 : 1 // Intersections on top
        });
        
        return googlePolygon;
      }).filter(polygon => polygon !== null);
    }
    
    function clearPolygons() {
      if (mapPolygons.length) {
        mapPolygons.forEach(polygon => polygon && polygon.setMap(null));
        mapPolygons = [];
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