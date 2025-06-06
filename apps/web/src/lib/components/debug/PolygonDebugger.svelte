<script>
  export let debugData = null;
  export let visible = false;
  
  // Toggle visibility
  function toggleVisibility() {
    visible = !visible;
  }
  
  // Format coordinates for display
  function formatCoords(coords) {
    if (!coords || coords.length !== 2) return 'Invalid';
    return `${coords[1].toFixed(6)}, ${coords[0].toFixed(6)}`;
  }
  
  // Format area
  function formatArea(area) {
    if (area < 1) {
      return `${(area * 1000000).toFixed(0)} m²`;
    }
    return `${area.toFixed(2)} km²`;
  }
</script>

{#if debugData}
  <div class="debug-panel">
    <button 
      class="debug-toggle"
      on:click={toggleVisibility}
      class:active={visible}
    >
      🐛 Debug Data ({debugData.isochrones?.length || 0} isochrones, {debugData.candidates?.length || 0} candidates)
    </button>
    
    {#if visible}
      <div class="debug-content">
        <!-- Centroid Info -->
        {#if debugData.centroid}
          <div class="debug-section">
            <h3>📍 Centroid</h3>
            <p><strong>Location:</strong> {formatCoords(debugData.centroid.coordinates)}</p>
            {#if debugData.centroid.travel_times}
              <div class="travel-times">
                <strong>Travel Times:</strong>
                {#each debugData.centroid.travel_times as tt}
                  <div class="travel-time">
                    {tt.address}: {tt.duration}min ({tt.speed.toFixed(1)} km/h)
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
        
        <!-- Isochrones -->
        {#if debugData.isochrones && debugData.isochrones.length > 0}
          <div class="debug-section">
            <h3>🌐 Isochrones ({debugData.isochrones.length})</h3>
            {#each debugData.isochrones as isochrone, i}
              <div class="isochrone-item">
                <h4>Isochrone {i + 1}</h4>
                <p><strong>Origin:</strong> {isochrone.origin_address}</p>
                <p><strong>Time Limit:</strong> {isochrone.time_limit_minutes}min</p>
                <p><strong>Area:</strong> {formatArea(isochrone.area_km2)}</p>
                <p><strong>Boundary Points:</strong> {isochrone.boundary_points}</p>
                {#if isochrone.holes > 0}
                  <p><strong>Holes:</strong> {isochrone.holes}</p>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
        
        <!-- Intersections -->
        {#if debugData.intersections && debugData.intersections.length > 0}
          <div class="debug-section">
            <h3>🔗 Intersections ({debugData.intersections.length})</h3>
            {#each debugData.intersections as intersection, i}
              <div class="intersection-item">
                <h4>Intersection {i + 1}</h4>
                <p><strong>Area:</strong> {formatArea(intersection.area_km2)}</p>
                <p><strong>Boundary Points:</strong> {intersection.boundary_points}</p>
                <p><strong>Candidates Generated:</strong> {intersection.candidates_generated}</p>
              </div>
            {/each}
          </div>
        {/if}
        
        <!-- Candidates -->
        {#if debugData.candidates && debugData.candidates.length > 0}
          <div class="debug-section">
            <h3>🎯 Candidates ({debugData.candidates.length})</h3>
            {#each debugData.candidates as candidate, i}
              <div class="candidate-item" class:best={candidate.is_best}>
                <h4>
                  Candidate {i + 1} 
                  {#if candidate.is_best}🏆{/if}
                </h4>
                <p><strong>Type:</strong> {candidate.type}</p>
                <p><strong>Location:</strong> {formatCoords(candidate.coordinates)}</p>
                {#if candidate.score_minutes}
                  <p><strong>Score:</strong> {candidate.score_minutes.toFixed(1)}min</p>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .debug-panel {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    max-width: 400px;
    font-family: system-ui, -apple-system, sans-serif;
  }
  
  .debug-toggle {
    background: rgba(0, 0, 0, 0.8);
    color: white;
    border: none;
    padding: 12px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
    width: 100%;
    text-align: left;
  }
  
  .debug-toggle:hover {
    background: rgba(0, 0, 0, 0.9);
    transform: translateY(-1px);
  }
  
  .debug-toggle.active {
    background: #3B82F6;
    border-radius: 8px 8px 0 0;
  }
  
  .debug-content {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 0 0 8px 8px;
    max-height: 70vh;
    overflow-y: auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  
  .debug-section {
    padding: 16px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  }
  
  .debug-section:last-child {
    border-bottom: none;
  }
  
  .debug-section h3 {
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 600;
    color: #1F2937;
  }
  
  .debug-section h4 {
    margin: 8px 0 4px 0;
    font-size: 14px;
    font-weight: 600;
    color: #374151;
  }
  
  .debug-section p {
    margin: 4px 0;
    font-size: 13px;
    color: #6B7280;
  }
  
  .isochrone-item,
  .intersection-item,
  .candidate-item {
    background: rgba(0, 0, 0, 0.02);
    padding: 8px;
    border-radius: 4px;
    margin: 8px 0;
  }
  
  .candidate-item.best {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
  }
  
  .travel-times {
    margin-top: 8px;
  }
  
  .travel-time {
    font-size: 12px;
    color: #6B7280;
    margin: 2px 0;
    padding-left: 8px;
  }
  
  /* Mobile responsive */
  @media (max-width: 768px) {
    .debug-panel {
      top: 10px;
      right: 10px;
      left: 10px;
      max-width: none;
    }
    
    .debug-content {
      max-height: 50vh;
    }
  }
</style> 