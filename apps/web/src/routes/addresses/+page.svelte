<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { 
    addresses, 
    defaultAddress, 
    isLoading, 
    error,
    user,
    createAddress,
    deleteAddress,
    setDefaultAddress,
    clearError
  } from '$lib/stores/auth.js';
  import AddressSetup from '$lib/components/auth/AddressSetup.svelte';

  // State
  let showAddForm = false;
  let isDeleting = false;
  let deleteConfirmId = null;
  let successMessage = '';
  let localError = '';

  // Check authentication on mount
  onMount(() => {
    // The auth store will automatically load addresses when user is authenticated
    // If not authenticated, redirect to login
    if (!$user) {
      goto('/auth/login?redirect=/addresses');
    }
  });

  // Handle adding new address
  async function handleAddAddress(event) {
    const { address } = event.detail;
    
    if (!$user?.uid) {
      localError = 'User not authenticated';
      return;
    }
    
    const result = await createAddress($user.uid, address);
    
    if (result.success) {
      showAddForm = false;
      showSuccessMessage('Address added successfully!');
    }
  }

  // Handle deleting address
  async function handleDeleteAddress(addressId) {
    isDeleting = true;
    
    const result = await deleteAddress(addressId);
    
    if (result.success) {
      showSuccessMessage('Address deleted successfully!');
    }
    
    isDeleting = false;
    deleteConfirmId = null;
  }

  // Handle setting default address
  async function handleSetDefault(addressId) {
    if (!$user?.uid) {
      localError = 'User not authenticated';
      return;
    }
    
    const result = await setDefaultAddress($user.uid, addressId);
    
    if (result.success) {
      showSuccessMessage('Default address updated!');
    }
  }

  // Show success message
  function showSuccessMessage(message) {
    successMessage = message;
    setTimeout(() => {
      successMessage = '';
    }, 3000);
  }

  // Clear error
  function handleClearError() {
    clearError();
  }

  // Get address icon based on name
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

<svelte:head>
  <title>My Addresses | Voilà!</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <!-- Header -->
  <div class="bg-white shadow-sm">
    <div class="max-w-4xl mx-auto px-4 py-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <button 
            on:click={() => goto('/profile')}
            class="mr-3 p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 class="text-xl font-bold text-gray-900">My Addresses</h1>
        </div>
        
        <button
          on:click={() => showAddForm = true}
          class="btn btn-primary px-4 py-2 rounded-lg text-sm font-medium"
        >
          Add Address
        </button>
      </div>
    </div>
  </div>

  <!-- Content -->
  <div class="max-w-4xl mx-auto px-4 py-6">
    <!-- Success Message -->
    {#if successMessage}
      <div class="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
        <div class="flex items-center">
          <svg class="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span class="text-sm text-green-800">{successMessage}</span>
        </div>
      </div>
    {/if}

    <!-- Error Message -->
    {#if $error}
      <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <svg class="w-4 h-4 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="text-sm text-red-800">{$error}</span>
          </div>
          <button 
            on:click={handleClearError}
            class="text-red-600 hover:text-red-800"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    {/if}

    <!-- Loading State -->
    {#if $isLoading}
      <div class="flex justify-center items-center py-12">
        <div class="loader mr-3"></div>
        <span class="text-gray-600">Loading addresses...</span>
      </div>
    
    <!-- Add Address Form -->
    {:else if showAddForm}
      <div class="bg-white rounded-lg shadow-sm p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-medium text-gray-900">Add New Address</h2>
          <button 
            on:click={() => showAddForm = false}
            class="text-gray-400 hover:text-gray-600"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <AddressSetup 
          on:address-setup={handleAddAddress}
        />
      </div>
    
    <!-- Addresses List -->
    {:else if $addresses.length > 0}
      <div class="space-y-4">
        {#each $addresses as address (address.id)}
          <div class="bg-white rounded-lg shadow-sm p-4">
            <div class="flex items-start justify-between">
              <div class="flex items-start space-x-3">
                <div class="text-2xl">
                  {getAddressIcon(address.name)}
                </div>
                
                <div class="flex-1">
                  <div class="flex items-center space-x-2">
                    <h3 class="font-medium text-gray-900">{address.name}</h3>
                    {#if address.isDefault}
                      <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        Default
                      </span>
                    {/if}
                  </div>
                  <p class="text-sm text-gray-600 mt-1">{address.formatted}</p>
                  <p class="text-xs text-gray-400 mt-1">
                    Added {new Date(address.createdAt?.toDate()).toLocaleDateString()}
                  </p>
                </div>
              </div>
              
              <div class="flex items-center space-x-2">
                {#if !address.isDefault}
                  <button
                    on:click={() => handleSetDefault(address.id)}
                    class="text-sm text-blue-600 hover:text-blue-800"
                    disabled={$isLoading}
                  >
                    Set as default
                  </button>
                {/if}
                
                <button
                  on:click={() => deleteConfirmId = address.id}
                  class="text-sm text-red-600 hover:text-red-800"
                  disabled={$isLoading || isDeleting}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    
    <!-- Empty State -->
    {:else}
      <div class="text-center py-12">
        <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-gray-900 mb-2">No addresses yet</h3>
        <p class="text-gray-600 mb-6">Add your first address to start finding meeting spots with friends.</p>
        <button
          on:click={() => showAddForm = true}
          class="btn btn-primary px-6 py-2 rounded-lg font-medium"
        >
          Add Your First Address
        </button>
      </div>
    {/if}
  </div>
</div>

<!-- Delete Confirmation Modal -->
{#if deleteConfirmId}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 max-w-sm mx-4">
      <h3 class="text-lg font-medium text-gray-900 mb-2">Delete Address</h3>
      <p class="text-gray-600 mb-4">
        Are you sure you want to delete this address? This action cannot be undone.
      </p>
      
      <div class="flex space-x-3">
        <button
          on:click={() => deleteConfirmId = null}
          class="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          disabled={isDeleting}
        >
          Cancel
        </button>
        <button
          on:click={() => handleDeleteAddress(deleteConfirmId)}
          class="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          disabled={isDeleting}
        >
          {#if isDeleting}
            <span class="loader loader-sm mr-2"></span>
            Deleting...
          {:else}
            Delete
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
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