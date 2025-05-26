<script>
  import { createEventDispatcher } from 'svelte';
  import AddressInput from '$components/maps/AddressInput.svelte';
  
  const dispatch = createEventDispatcher();
  
  export let addresses = [];
  export let isCalculating = false;
  export let mapBounds = null;
  export let error = null;
  
  let nextId = 3;
  
  function addAddress() {
    addresses = [...addresses, { id: nextId, value: '', coordinates: null }];
    nextId += 1;
    dispatch('addresses-changed', { addresses });
  }
  
  function removeAddress(id) {
    if (addresses.length <= 2) {
      dispatch('error', { message: "You need at least two addresses" });
      return;
    }
    addresses = addresses.filter(addr => addr.id !== id);
    dispatch('addresses-changed', { addresses });
  }
  
  function updateAddress(id, value) {
    addresses = addresses.map(addr => 
      addr.id === id ? { ...addr, value, coordinates: null } : addr
    );
    dispatch('addresses-changed', { addresses });
  }
  
  function updateAddressWithCoordinates(id, value, coordinates) {
    addresses = addresses.map(addr => 
      addr.id === id ? { ...addr, value, coordinates } : addr
    );
    dispatch('addresses-changed', { addresses });
  }
  
  function handlePlaceSelected(event, addressId) {
    const { address, location } = event.detail;
    const coordinates = [location.lng, location.lat];
    updateAddressWithCoordinates(addressId, address, coordinates);
  }
  
  function handleFindMeetingPoint() {
    dispatch('find-meeting-point');
  }
</script>

<div class="card p-4 md:p-6 mb-6 shadow-md">
  {#if error}
    <div class="alert alert-error mb-4 p-2 text-sm rounded-md bg-red-50 text-red-700 border border-red-200">
      <span>{error}</span>
    </div>
  {/if}
  
  <h2 class="text-lg font-semibold mb-3">Where is everyone?</h2>
  
  <div class="space-y-3 mb-5">
    {#each addresses as address (address.id)}
      <div class="flex gap-2">
        <div class="flex-grow">
          <AddressInput 
            value={address.value} 
            placeholder="Enter an address"
            bounds={mapBounds}
            on:input={(e) => updateAddress(address.id, e.detail.value)}
            on:place-selected={(e) => handlePlaceSelected(e, address.id)}
          />
        </div>
        {#if addresses.length > 2}
          <button 
            class="btn btn-icon btn-outline" 
            on:click={() => removeAddress(address.id)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        {/if}
      </div>
    {/each}
  </div>
  
  <div class="flex justify-between items-center">
    <button class="btn btn-sm btn-outline" on:click={addAddress}>
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      Add
    </button>
    
    <button 
      class="btn btn-sm btn-primary" 
      on:click={handleFindMeetingPoint} 
      disabled={isCalculating}
    >
      {#if isCalculating}
        <span class="loader loader-sm mr-1"></span>
        <span>Calculating...</span>
      {:else}
        <span>📍 Find Meeting Point</span>
      {/if}
    </button>
  </div>
  
  <slot name="venue-options" />
</div>
