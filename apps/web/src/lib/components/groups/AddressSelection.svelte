<script>
    import { createEventDispatcher, onMount } from 'svelte';
    import { addresses, user } from '$stores/auth';
    
    const dispatch = createEventDispatcher();
    
    export let currentGroupId = null;
    export let selectedAddressId = null;
    export let disabled = false;
    
    let showModal = false;
    let isLoading = false;
    let error = null;
    
    // Get selected address details
    $: selectedAddress = selectedAddressId 
      ? $addresses.find(addr => addr.id === selectedAddressId)
      : null;
    
    function openModal() {
      showModal = true;
      error = null;
    }
    
    function closeModal() {
      showModal = false;
      error = null;
    }
    
    async function selectAddress(addressId) {
      isLoading = true;
      error = null;
      
      try {
        // Dispatch the address selection
        dispatch('address-selected', { 
          addressId, 
          address: $addresses.find(addr => addr.id === addressId)
        });
        
        closeModal();
      } catch (err) {
        error = err.message || 'Failed to select address';
      } finally {
        isLoading = false;
      }
    }
    
    function getAddressIcon(name) {
      const iconMap = {
        'home': '🏠',
        'work': '🏢',
        'school': '🎓',
        'gym': '💪',
        'other': '📍'
      };
      
      return iconMap[name.toLowerCase()] || '📍';
    }
  </script>
  
  <!-- Address Selection Button -->
  <div class="bg-white shadow rounded-lg p-4 mb-4">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-sm font-medium text-gray-900 mb-1">Your Location</h3>
        {#if selectedAddress}
          <div class="flex items-center">
            <span class="text-lg mr-2">{getAddressIcon(selectedAddress.name)}</span>
            <div>
              <p class="text-sm font-medium text-gray-900">{selectedAddress.name}</p>
              <p class="text-xs text-gray-500 truncate max-w-xs">{selectedAddress.formatted}</p>
            </div>
          </div>
        {:else}
          <p class="text-sm text-gray-500">Choose your location for this group</p>
        {/if}
      </div>
      
      <button
        type="button"
        on:click={openModal}
        {disabled}
        class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {selectedAddress ? 'Change' : 'Select'}
      </button>
    </div>
  </div>
  
  <!-- Address Selection Modal -->
  {#if showModal}
    <div class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <!-- Background overlay -->
        <div
          class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          on:click={closeModal}
          aria-hidden="true"
        ></div>
  
        <!-- Modal panel -->
        <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
          <div class="bg-white px-4 pt-5 pb-4 sm:p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                Choose Your Location
              </h3>
              <button
                type="button"
                class="text-gray-400 hover:text-gray-600"
                on:click={closeModal}
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {#if error}
              <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div class="flex items-center">
                  <svg class="w-4 h-4 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span class="text-sm text-red-800">{error}</span>
                </div>
              </div>
            {/if}
            
            <div class="space-y-2">
              {#if $addresses.length > 0}
                {#each $addresses as address (address.id)}
                  <button
                    type="button"
                    class={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                      selectedAddressId === address.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    on:click={() => selectAddress(address.id)}
                    disabled={isLoading}
                  >
                    <div class="flex items-center">
                      <span class="text-xl mr-3">{getAddressIcon(address.name)}</span>
                      <div class="flex-1">
                        <div class="flex items-center justify-between">
                          <p class="font-medium text-gray-900">{address.name}</p>
                          {#if address.isDefault}
                            <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                              Default
                            </span>
                          {/if}
                        </div>
                        <p class="text-sm text-gray-600 truncate">{address.formatted}</p>
                      </div>
                      
                      {#if selectedAddressId === address.id}
                        <svg class="w-5 h-5 text-primary-600 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                      {/if}
                    </div>
                  </button>
                {/each}
              {:else}
                <div class="text-center py-8">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <h3 class="text-lg font-medium text-gray-900 mb-2">No addresses saved</h3>
                  <p class="text-gray-600 mb-4">You need to add an address before joining group activities</p>
                  <a
                    href="/addresses" 
                    class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
                  >
                    Add Address
                  </a>
                </div>
              {/if}
            </div>
          </div>
          
          {#if $addresses.length > 0}
            <div class="bg-gray-50 px-4 py-3 sm:px-6 flex justify-between">
              <button
                type="button"
                on:click={closeModal}
                class="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Cancel
              </button>
              
              <a
                href="/addresses"
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Manage Addresses
              </a>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}