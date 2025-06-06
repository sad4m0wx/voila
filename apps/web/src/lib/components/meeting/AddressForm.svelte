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

<div class="card card-gradient p-3 mb-3 animate-fade-in">
  {#if error}
    <div class="alert alert-error mb-2">
      <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span class="text-sm">{error}</span>
    </div>
  {/if}
  
  <h2 class="text-lg font-bold mb-3 text-secondary-800">Where is everyone?</h2>
  
  <div class="space-y-2 mb-3">
    {#each addresses as address (address.id)}
      <div class="flex gap-2 animate-slide-up">
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
            class="btn btn-icon btn-sm text-error-600 border-error-300 hover:bg-error-50 hover:border-error-400" 
            on:click={() => removeAddress(address.id)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        {/if}
      </div>
    {/each}
  </div>
  
  <div class="flex justify-between items-center gap-3">
    <button class="btn btn-secondary btn-sm flex-shrink-0" on:click={addAddress}>
      <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      Add
    </button>
    
    <button 
      class="btn btn-primary flex-1" 
      on:click={handleFindMeetingPoint} 
      disabled={isCalculating}
    >
      {#if isCalculating}
        <span class="loader loader-sm mr-2"></span>
        <span class="text-sm">Calculating...</span>
      {:else}
        <span class="mr-2">📍</span>
        <span class="text-sm font-medium">Find Meeting Point</span>
      {/if}
    </button>
  </div>
  
  <slot name="venue-options" />
</div>
