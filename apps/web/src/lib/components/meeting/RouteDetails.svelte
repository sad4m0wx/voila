<script>
  export let routes = [];
  export let travelTimes = [];
  
  // Helper function to get vehicle icon
  function getVehicleIcon(vehicleType) {
    const icons = {
      'bus': '🚌',
      'subway': '🚇',
      'metro': '🚇', 
      'tram': '🚊',
      'train': '🚂',
      'rail': '🚂',
      'walking': '🚶',
      'walk': '🚶'
    };
    return icons[vehicleType?.toLowerCase()] || '🚌';
  }
  
  // Helper function to format duration
  function formatDuration(seconds) {
    const minutes = Math.ceil(seconds / 60);
    return minutes === 1 ? '1 min' : `${minutes} mins`;
  }
  
  // Helper function to get mode color
  function getModeColor(mode, vehicleType) {
    if (mode === 'walking') return 'bg-green-100 text-green-800 border-green-200';
    if (mode === 'transit') {
      switch(vehicleType?.toLowerCase()) {
        case 'subway':
        case 'metro':
          return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'bus':
          return 'bg-orange-100 text-orange-800 border-orange-200';
        case 'tram':
          return 'bg-purple-100 text-purple-800 border-purple-200';
        case 'train':
        case 'rail':
          return 'bg-red-100 text-red-800 border-red-200';
        default:
          return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      }
    }
    return 'bg-gray-100 text-gray-800 border-gray-200';
  }
  
  // Combine routes with travel time info
  $: routesWithTravelTime = routes.map(route => {
    const travelTime = travelTimes.find(tt => tt.id === route.id);
    return {
      ...route,
      travelTime
    };
  });
</script>

{#if routesWithTravelTime.length > 0}
  <div class="space-y-4">    
    {#each routesWithTravelTime as route, index}
      <div class="bg-white rounded-lg border border-neutral-200 overflow-hidden">
        <!-- Route Header -->
        <div class="bg-gradient-to-r from-primary-50 to-primary-100 px-4 py-3 border-b border-primary-200">
          <div class="flex items-start justify-between">
            <div class="flex items-center">
              <div class="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-semibold mr-3">
                {index + 1}
              </div>
              <div>
                <p class="font-medium text-secondary-800 text-sm">
                  {route.travelTime?.address || `Route ${index + 1}`}
                </p>
              </div>
            </div>
            <div class="text-right">
              <div class="text-sm font-semibold text-primary-700">
                {route.travelTime?.duration || 0} mins
              </div>
              {#if route.travelTime?.estimated}
                <div class="text-xs text-secondary-500">estimated</div>
              {/if}
            </div>
          </div>
        </div>
        
        <!-- Route Steps -->
        {#if route.steps && route.steps.length > 0}
          <div class="p-4">
            <div class="space-y-3">
              {#each route.steps as step, stepIndex}
                <div class="flex items-start space-x-3">
                  <!-- Step Icon -->
                  <div class="flex-shrink-0 mt-1">
                    <div class="w-8 h-8 rounded-lg border {getModeColor(step.mode, step.transit_details?.line?.vehicle_type)} flex items-center justify-center text-sm">
                      {getVehicleIcon(step.mode === 'transit' ? step.transit_details?.line?.vehicle_type : step.mode)}
                    </div>
                  </div>
                  
                  <!-- Step Details -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-1">
                      <div class="flex items-center space-x-2">
                        {#if step.mode === 'transit' && step.transit_details}
                          <span class="font-medium text-secondary-800 text-sm">
                            {step.transit_details.line.short_name || step.transit_details.line.name}
                          </span>
                          <span class="px-2 py-1 bg-secondary-100 text-secondary-700 rounded text-xs font-medium">
                            {step.transit_details.line.vehicle_type}
                          </span>
                        {:else}
                          <span class="font-medium text-secondary-800 text-sm capitalize">
                            {step.mode}
                          </span>
                        {/if}
                      </div>
                      <span class="text-xs text-secondary-500 font-medium">
                        {formatDuration(step.duration)}
                      </span>
                    </div>
                    
                    
                    {#if step.mode === 'transit' && step.transit_details}
                      <div class="bg-secondary-50 rounded-lg p-3 space-y-2">
                        {#if step.transit_details.departure_stop && step.transit_details.arrival_stop}
                          <div class="flex items-center justify-between text-xs">
                            <div class="flex items-center space-x-1">
                              <span class="w-2 h-2 bg-green-500 rounded-full"></span>
                              <span class="text-secondary-700 font-medium">From:</span>
                              <span class="text-secondary-600">{step.transit_details.departure_stop}</span>
                            </div>
                          </div>
                          <div class="flex items-center justify-between text-xs">
                            <div class="flex items-center space-x-1">
                              <span class="w-2 h-2 bg-red-500 rounded-full"></span>
                              <span class="text-secondary-700 font-medium">To:</span>
                              <span class="text-secondary-600">{step.transit_details.arrival_stop}</span>
                            </div>
                          </div>
                        {/if}
                        {#if step.transit_details.num_stops > 0}
                          <div class="text-xs text-secondary-600">
                            <span class="font-medium">{step.transit_details.num_stops}</span> stops
                          </div>
                        {/if}
                      </div>
                    {/if}
                    
                    {#if step.distance}
                      <div class="text-xs text-secondary-500 mt-1">
                        {(step.distance / 1000).toFixed(1)} km
                      </div>
                    {/if}
                  </div>
                </div>
                
                <!-- Connector line (except for last step) -->
                {#if stepIndex < route.steps.length - 1}
                  <div class="flex items-center ml-4">
                    <div class="w-px h-4 bg-secondary-200"></div>
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        {:else}
          <div class="p-4 text-center text-secondary-500 text-sm">
            No detailed route information available
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if} 