<script>
  import { onMount, onDestroy } from 'svelte';
  import { getIsochroneColor, getIsochroneStrokeColor } from '$lib/services/isochroneApi.js';
  
  // Props
  export let map = null;
  export let isochrones = [];
  export let intersections = [];
  export let visible = true;
  export let showLabels = true;
  export let opacity = 0.3;
  
  // Internal state
  let isochronePolygons = [];
  let intersectionPolygons = [];
  let isochroneLabels = [];
  let mounted = false;
  
  onMount(() => {
    mounted = true;
    if (map && isochrones.length > 0) {
      renderIsochrones();
    }
    if (map && intersections.length > 0) {
      renderIntersections();
    }
  });
  
  onDestroy(() => {
    clearIsochrones();
    clearIntersections();
  });
  
  // Watch for isochrone changes
  $: if (mounted && map && isochrones) {
    clearIsochrones();
    if (visible && isochrones.length > 0) {
      renderIsochrones();
    }
  }
  
  // Watch for intersection changes
  $: if (mounted && map && intersections) {
    clearIntersections();
    if (visible && intersections.length > 0) {
      renderIntersections();
    }
  }
  
  // Watch for visibility changes
  $: if (mounted && map) {
    setVisibility(visible);
  }
  
  function renderIsochrones() {
    if (!map || !window.google) return;
    
    isochrones.forEach((isochrone, index) => {
      try {
        // Convert GeoJSON coordinates to Google Maps format
        const paths = isochrone.polygon.coordinates.map(ring => 
          ring.map(coord => ({
            lat: coord[1],
            lng: coord[0]
          }))
        );
        
        if (paths.length === 0 || paths[0].length === 0) {
          console.warn('Empty polygon for isochrone:', isochrone.id);
          return;
        }
        
        // Create the polygon
        const polygon = new window.google.maps.Polygon({
          paths: paths[0], // Use exterior ring only for now
          strokeColor: getIsochroneStrokeColor(index),
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: getIsochroneColor(index, opacity),
          fillOpacity: opacity,
          map: visible ? map : null,
          clickable: true,
          zIndex: 1
        });
        
        // Add click listener for info
        polygon.addListener('click', (event) => {
          showIsochroneInfo(isochrone, event.latLng);
        });
        
        isochronePolygons.push({
          polygon,
          isochrone,
          index
        });
        
        // Add label if enabled
        if (showLabels && visible) {
          const center = calculatePolygonCenter(paths[0]);
          const label = new window.google.maps.InfoWindow({
            content: `
              <div class="isochrone-label">
                <strong>${isochrone.name}</strong><br>
                <span class="text-sm text-gray-600">
                  ${isochrone.timeLimitMinutes}min • ${isochrone.profile}<br>
                  ${formatArea(isochrone.areaKm2)}
                </span>
              </div>
            `,
            position: center,
            disableAutoPan: true,
            pixelOffset: new window.google.maps.Size(0, -10)
          });
          
          if (visible) {
            label.open(map);
          }
          
          isochroneLabels.push(label);
        }
        
      } catch (error) {
        console.error('Error rendering isochrone:', isochrone.id, error);
      }
    });
  }
  
  function renderIntersections() {
    if (!map || !window.google) return;
    
    intersections.forEach((intersection, index) => {
      try {
        // Convert GeoJSON coordinates to Google Maps format
        const paths = intersection.polygon.coordinates.map(ring => 
          ring.map(coord => ({
            lat: coord[1],
            lng: coord[0]
          }))
        );
        
        if (paths.length === 0 || paths[0].length === 0) {
          console.warn('Empty intersection polygon:', intersection.id);
          return;
        }
        
        // Create the intersection polygon with different styling
        const polygon = new window.google.maps.Polygon({
          paths: paths[0],
          strokeColor: '#FF6B6B',
          strokeOpacity: 1,
          strokeWeight: 3,
          fillColor: '#FF6B6B',
          fillOpacity: 0.2,
          map: visible ? map : null,
          clickable: true,
          zIndex: 10 // Higher z-index to show on top
        });
        
        // Add click listener for intersection info
        polygon.addListener('click', (event) => {
          showIntersectionInfo(intersection, event.latLng);
        });
        
        intersectionPolygons.push({
          polygon,
          intersection,
          index
        });
        
      } catch (error) {
        console.error('Error rendering intersection:', intersection.id, error);
      }
    });
  }
  
  function clearIsochrones() {
    isochronePolygons.forEach(({ polygon }) => {
      polygon.setMap(null);
    });
    isochronePolygons = [];
    
    isochroneLabels.forEach(label => {
      label.close();
    });
    isochroneLabels = [];
  }
  
  function clearIntersections() {
    intersectionPolygons.forEach(({ polygon }) => {
      polygon.setMap(null);
    });
    intersectionPolygons = [];
  }
  
  function setVisibility(visible) {
    isochronePolygons.forEach(({ polygon }) => {
      polygon.setMap(visible ? map : null);
    });
    
    intersectionPolygons.forEach(({ polygon }) => {
      polygon.setMap(visible ? map : null);
    });
    
    isochroneLabels.forEach(label => {
      if (visible) {
        label.open(map);
      } else {
        label.close();
      }
    });
  }
  
  function calculatePolygonCenter(path) {
    let lat = 0;
    let lng = 0;
    
    path.forEach(point => {
      lat += point.lat;
      lng += point.lng;
    });
    
    return {
      lat: lat / path.length,
      lng: lng / path.length
    };
  }
  
  function showIsochroneInfo(isochrone, position) {
    const infoWindow = new window.google.maps.InfoWindow({
      content: `
        <div class="isochrone-info p-3 max-w-xs">
          <h3 class="font-semibold text-lg mb-2">${isochrone.name}</h3>
          <div class="space-y-1 text-sm">
            <div><strong>Time Limit:</strong> ${isochrone.timeLimitMinutes} minutes</div>
            <div><strong>Transport:</strong> ${isochrone.profile}</div>
            <div><strong>Area:</strong> ${formatArea(isochrone.areaKm2)}</div>
            <div><strong>Algorithm:</strong> ${isochrone.algorithmUsed}</div>
            <div><strong>Computation:</strong> ${isochrone.computationTimeMs}ms</div>
          </div>
        </div>
      `,
      position: position
    });
    
    infoWindow.open(map);
  }
  
  function showIntersectionInfo(intersection, position) {
    const infoWindow = new window.google.maps.InfoWindow({
      content: `
        <div class="intersection-info p-3 max-w-xs">
          <h3 class="font-semibold text-lg mb-2">Intersection Zone</h3>
          <div class="space-y-1 text-sm">
            <div><strong>Area:</strong> ${formatArea(intersection.areaKm2)}</div>
            <div><strong>Contributing Isochrones:</strong></div>
            <ul class="list-disc list-inside ml-2">
              ${intersection.contributingIsochrones.map(id => `<li>${id}</li>`).join('')}
            </ul>
          </div>
        </div>
      `,
      position: position
    });
    
    infoWindow.open(map);
  }
  
  function formatArea(areaKm2) {
    if (areaKm2 < 0.01) {
      const areaM2 = areaKm2 * 1000000;
      return `${areaM2.toFixed(0)} m²`;
    } else if (areaKm2 < 1) {
      const areaM2 = areaKm2 * 1000000;
      return `${(areaM2 / 1000).toFixed(1)} k m²`;
    } else {
      return `${areaKm2.toFixed(2)} km²`;
    }
  }
</script>

{#if import.meta.env.DEV}
<style>
  :global(.isochrone-label) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: white;
    border-radius: 4px;
    padding: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    border: 1px solid #e5e7eb;
  }
  
  :global(.isochrone-info),
  :global(.intersection-info) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
</style>
{/if}