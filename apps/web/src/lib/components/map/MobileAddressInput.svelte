<script>
  import { AddressInput } from '$map/web';
  
  let address = '';
  let coordinates = null;
  
  function handlePlaceSelected(event) {
    const { address, location } = event.detail;
    
    address = address;
    coordinates = [location.lng, location.lat]; // Convert to [lng, lat] format
    
    // Additional handling as needed
  }
</script>

<AddressInput
  value={address}
  placeholder="Enter an address or location"
  on:place-selected={handlePlaceSelected}
/>