<script>
  import { onMount, onDestroy } from 'svelte';
  
  // Props
  export let map = null;
  export let heatmapData = null;
  export let visible = true;
  export let opacity = 0.6;
  
  // Internal state
  let heatmapLayer = null;
  let overlayCanvas = null;
  let mapOverlay = null;
  
  // Watch for changes
  $: if (map && heatmapData && visible) {
    createHeatmapOverlay();
  } else if (mapOverlay && (!visible || !heatmapData)) {
    removeHeatmapOverlay();
  }
  
  $: if (mapOverlay && opacity !== undefined) {
    updateOpacity();
  }
  
  onDestroy(() => {
    removeHeatmapOverlay();
  });
  


  function createHeatmapOverlay() {
    if (!map || !heatmapData || !window.google) return;
    
    // Remove existing overlay
    removeHeatmapOverlay();
    
    // Create custom overlay
    class HeatmapOverlay extends window.google.maps.OverlayView {
      constructor(bounds, heatData, opacity) {
        super();
        this.bounds = bounds;
        this.heatData = heatData;
        this.opacity = opacity;
        this.canvas = null;
      }
      
      onAdd() {
        // Create canvas element
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'absolute';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.opacity = this.opacity;
        
        // Add to overlay layer
        const panes = this.getPanes();
        panes.overlayLayer.appendChild(this.canvas);
      }
      
      draw() {
        const projection = this.getProjection();
        const bounds = this.bounds;
        
        // Get pixel coordinates for bounds
        const sw = projection.fromLatLngToDivPixel(
          new window.google.maps.LatLng(bounds.south, bounds.west)
        );
        const ne = projection.fromLatLngToDivPixel(
          new window.google.maps.LatLng(bounds.north, bounds.east)
        );
        
        // Set canvas size and position with reasonable limits
        let width = Math.abs(ne.x - sw.x);
        let height = Math.abs(sw.y - ne.y);
        
        // Limit canvas size for performance
        const MAX_CANVAS_SIZE = 2000;
        if (width > MAX_CANVAS_SIZE || height > MAX_CANVAS_SIZE) {
          const scale = Math.min(MAX_CANVAS_SIZE / width, MAX_CANVAS_SIZE / height);
          width *= scale;
          height *= scale;
        }
        
        this.canvas.style.left = Math.min(sw.x, ne.x) + 'px';
        this.canvas.style.top = Math.min(ne.y, sw.y) + 'px';
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.width = Math.abs(ne.x - sw.x) + 'px';
        this.canvas.style.height = Math.abs(sw.y - ne.y) + 'px';
        

        
        // Draw heatmap
        this.drawHeatmap(width, height);
      }
      
      drawHeatmap(width, height) {
        const ctx = this.canvas.getContext('2d');
        
        const gridSize = this.heatData.grid_size;
        const heatValues = this.heatData.heat_values;
        
        // Calculate scaling factors
        const scaleX = width / gridSize;
        const scaleY = height / gridSize;
        
        // Convert heat value to color (blue to red gradient)
        const heatToColor = (heat) => {
          if (heat <= 0) return { r: 0, g: 0, b: 0, a: 0 };
          
          const normalizedHeat = Math.min(1, Math.max(0, heat));
          let r, g, b;
          
          if (normalizedHeat < 0.25) {
            // Blue to cyan
            const t = normalizedHeat * 4;
            r = 0;
            g = Math.floor(255 * t);
            b = 255;
          } else if (normalizedHeat < 0.5) {
            // Cyan to green
            const t = (normalizedHeat - 0.25) * 4;
            r = 0;
            g = 255;
            b = Math.floor(255 * (1 - t));
          } else if (normalizedHeat < 0.75) {
            // Green to yellow
            const t = (normalizedHeat - 0.5) * 4;
            r = Math.floor(255 * t);
            g = 255;
            b = 0;
          } else {
            // Yellow to red
            const t = (normalizedHeat - 0.75) * 4;
            r = 255;
            g = Math.floor(255 * (1 - t));
            b = 0;
          }
          
          return { r, g, b, a: 0.8 };
        };
        
        // Clear canvas first
        ctx.clearRect(0, 0, width, height);
        
        // Draw each grid cell using fillRect for better visibility at all zoom levels
        for (let i = 0; i < gridSize; i++) {
          for (let j = 0; j < gridSize; j++) {
            const heat = heatValues[i][j];
            if (heat > 0) {
              const color = heatToColor(heat);
              
              // Calculate cell bounds with minimum size for visibility
              const cellX = j * scaleX;
              const cellY = (gridSize - 1 - i) * scaleY; // Flip Y coordinate
              const cellWidth = Math.max(2, scaleX); // Minimum 2 pixels wide
              const cellHeight = Math.max(2, scaleY); // Minimum 2 pixels tall
              
              // Draw rectangle
              ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
              ctx.fillRect(cellX, cellY, cellWidth, cellHeight);
            }
          }
        }
      }
      
      onRemove() {
        if (this.canvas && this.canvas.parentNode) {
          this.canvas.parentNode.removeChild(this.canvas);
        }
      }
      
      updateOpacity(newOpacity) {
        if (this.canvas) {
          this.canvas.style.opacity = newOpacity;
        }
      }
    }
    
    // Create bounds from heatmap data
    const bounds = new window.google.maps.LatLngBounds(
      new window.google.maps.LatLng(heatmapData.bounding_box.south, heatmapData.bounding_box.west),
      new window.google.maps.LatLng(heatmapData.bounding_box.north, heatmapData.bounding_box.east)
    );
    
    // Create and add overlay
    mapOverlay = new HeatmapOverlay(heatmapData.bounding_box, heatmapData, opacity);
    mapOverlay.setMap(map);
    
    overlayCanvas = mapOverlay.canvas;
  }
  
  function removeHeatmapOverlay() {
    if (mapOverlay) {
      mapOverlay.setMap(null);
      mapOverlay = null;
      overlayCanvas = null;
    }
  }
  
  function updateOpacity() {
    if (mapOverlay && mapOverlay.updateOpacity) {
      mapOverlay.updateOpacity(opacity);
    }
  }
</script>

<!-- This component doesn't render any HTML, it just manages the map overlay --> 