<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { geocodeAddress, validateAddress } from '$lib/stores/auth.js';
  import AddressInput from '$lib/map/components/AddressInput.svelte';

  const dispatch = createEventDispatcher();

  // Props
  export let isLoading = false;

  // State
  let addressName = 'Home';
  let addressString = '';
  let selectedAddress = null;
  let error = '';
  let isSubmitting = false;
  let isValidating = false;

  // Predefined address names
  const addressNames = [
    'Home',
    'Work',
    'School',
    'Gym',
    'Other'
  ];

  // Computed values
  $: isFormValid = addressName.trim() && selectedAddress && validateAddress({
    name: addressName,
    formatted: selectedAddress.formatted,
    coordinates: selectedAddress.coordinates
  });

  // Handle address selection from AddressInput
  function handleAddressSelected(event) {
    const { address, location, placeId } = event.detail;
    
    selectedAddress = {
      formatted: address,
      coordinates: [location.lng, location.lat],
      placeId
    };
    
    addressString = address;
    error = '';
  }

  // Handle manual address input
  async function handleAddressInput(event) {
    const value = event.detail.value;
    addressString = value;
    
    if (!value.trim()) {
      selectedAddress = null;
      return;
    }

    // Clear previous selection if user is typing
    if (selectedAddress && selectedAddress.formatted !== value) {
      selectedAddress = null;
    }
  }

  // Validate address manually if not selected from autocomplete
  async function validateManualAddress() {
    if (!addressString.trim() || selectedAddress) return;

    isValidating = true;
    error = '';

    try {
      const result = await geocodeAddress(addressString);
      
      if (result.success) {
        selectedAddress = result.result;
        addressString = result.result.formatted;
      } else {
        error = 'Could not find this address. Please try a different address or select from the suggestions.';
      }
    } catch (err) {
      error = 'Failed to validate address. Please try again.';
    } finally {
      isValidating = false;
    }
  }

  // Handle form submission
  async function handleSubmit() {
    if (!isFormValid) {
      error = 'Please fill in all required fields';
      return;
    }

    // Validate address if not already selected
    if (!selectedAddress) {
      await validateManualAddress();
      if (!selectedAddress) return;
    }

    isSubmitting = true;
    error = '';

    try {
      const addressData = {
        name: addressName.trim(),
        formatted: selectedAddress.formatted,
        coordinates: selectedAddress.coordinates,
        placeId: selectedAddress.placeId,
        isDefault: true // First address is always default
      };

      dispatch('address-setup', { address: addressData });
    } catch (err) {
      error = 'Failed to save address. Please try again.';
      isSubmitting = false;
    }
  }

  // Handle address name selection
  function selectAddressName(name) {
    addressName = name;
  }

  // Handle custom address name input
  function handleNameInput(event) {
    addressName = event.target.value;
  }
</script>

<div class="address-setup">
  <div class="text-center mb-6">
    <h2 class="text-xl font-bold text-gray-900 mb-2">Add Your First Address</h2>
    <p class="text-gray-600">
      We need at least one address to help you find meeting points with friends.
    </p>
  </div>

  <form on:submit|preventDefault={handleSubmit} class="space-y-6">
    <!-- Address Name Selection -->
    <div>
      <label class="block text-neutral-700 font-medium text-sm mb-3">
        What should we call this address?
      </label>
      
      <div class="grid grid-cols-3 gap-2 mb-3">
        {#each addressNames.slice(0, 3) as name}
          <button
            type="button"
            class="px-3 py-2 text-sm border rounded-lg transition-colors {addressName === name ? 'bg-primary-50 border-primary-500 text-primary-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}"
            on:click={() => selectAddressName(name)}
          >
            {name}
          </button>
        {/each}
      </div>
      
      <div class="grid grid-cols-2 gap-2 mb-3">
        {#each addressNames.slice(3) as name}
          <button
            type="button"
            class="px-3 py-2 text-sm border rounded-lg transition-colors {addressName === name ? 'bg-primary-50 border-primary-500 text-primary-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}"
            on:click={() => selectAddressName(name)}
          >
            {name}
          </button>
        {/each}
      </div>

      <!-- Custom name input -->
      {#if !addressNames.includes(addressName)}
        <input
          type="text"
          class="input w-full p-3 rounded-lg text-sm"
          placeholder="Enter custom name"
          bind:value={addressName}
          on:input={handleNameInput}
          maxlength="20"
        />
      {/if}
    </div>

    <!-- Address Input -->
    <div>
      <label class="block text-neutral-700 font-medium text-sm mb-1.5">
        Address
      </label>
      
      <div class="relative">
        <AddressInput
          value={addressString}
          placeholder="Enter your address"
          on:place-selected={handleAddressSelected}
          on:input={handleAddressInput}
        />
        
        {#if isValidating}
          <div class="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div class="loader loader-sm"></div>
          </div>
        {/if}
      </div>

      {#if selectedAddress}
        <div class="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div class="flex items-center">
            <svg class="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span class="text-sm text-green-800">Address verified</span>
          </div>
          <p class="text-sm text-green-700 mt-1">{selectedAddress.formatted}</p>
        </div>
      {/if}
    </div>

    {#if error}
      <div class="alert alert-error p-3 text-sm rounded-lg">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        <span class="ml-2">{error}</span>
      </div>
    {/if}

    <!-- Submit Button -->
    <button
      type="submit"
      class="btn btn-primary w-full h-12 rounded-lg text-base font-medium"
      disabled={!isFormValid || isSubmitting || isValidating}
    >
      {#if isSubmitting}
        <span class="loader loader-sm mr-2"></span>
        <span>Saving address...</span>
      {:else if isValidating}
        <span class="loader loader-sm mr-2"></span>
        <span>Validating address...</span>
      {:else}
        Continue
      {/if}
    </button>

    <!-- Help Text -->
    <div class="text-center">
      <p class="text-xs text-gray-500">
        You can add more addresses later in your profile settings.
      </p>
    </div>
  </form>
</div>

<style>
  .address-setup {
    width: 100%;
    max-width: 400px;
    margin: 0 auto;
  }

  .alert {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    border-radius: 0.5rem;
  }

  .alert-error {
    background-color: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 1rem;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background-color: #3b82f6;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: #2563eb;
  }

  .input {
    border: 1px solid #d1d5db;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .loader {
    width: 1rem;
    height: 1rem;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .loader-sm {
    width: 0.875rem;
    height: 0.875rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style> 