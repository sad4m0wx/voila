<script>
  import { MapContainer } from '$map/web';
  
  // Props from parent
  export let meetingPoint = null;
  export let routes = [];
  export let myLocationControl = false;
  
  // Prepare markers and routes for the map
  let markers = [];
  let formattedRoutes = [];
  
  $: if (meetingPoint) {
    markers = [
      {
        position: meetingPoint.coordinates,
        title: meetingPoint.name,
        info: `<div><strong>${meetingPoint.name}</strong></div>`
      }
    ];
  }
  
  $: if (routes) {
    formattedRoutes = routes.map((route, index) => ({
      ...route,
      color: getRouteColor(index), 
      weight: 5
    }));
  }
  
  function getRouteColor(index) {
    const colors = ['#1a73e8', '#e53935', '#43a047', '#fb8c00', '#8e24aa'];
    return colors[index % colors.length];
  }
  
  function handleBounds(event) {
    // Forward the bounds event to parent if needed
    dispatch('bounds', event.detail);
  }
</script>

<MapContainer
  center={meetingPoint ? meetingPoint.coordinates : [2.3522, 48.8566]}
  zoom={12}
  markers={markers}
  routes={formattedRoutes}
  height="100%"
  on:bounds={handleBounds}
  on:ready={() => dispatch('ready')}
/>