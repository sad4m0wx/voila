<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { 
    contactsPermission,
    requestContactsPermissionWithUI,
    isContactsSupportedPlatform,
    getPermissionStatus
  } from '$lib/services/contactsPermissionService.js';
  import NativeLoading from '$components/utils/NativeLoading.svelte';

  const dispatch = createEventDispatcher();

  export let skipable = false; // Whether user can skip this step

  let permissionStatus = 'unknown';
  let isRequesting = false;

  onMount(() => {
    permissionStatus = getPermissionStatus();
    
    // Subscribe to permission state changes
    const unsubscribe = contactsPermission.subscribe(state => {
      if (state.hasPermission) {
        dispatch('permission-granted');
      }
      isRequesting = state.isRequesting;
    });

    return unsubscribe;
  });

  async function requestPermission() {
    const granted = await requestContactsPermissionWithUI();
    if (granted) {
      dispatch('permission-granted');
    }
  }

  function skipPermission() {
    if (skipable) {
      dispatch('permission-skipped');
    }
  }

  function goToSettings() {
    // This would ideally open device settings
    // For now, show instructions
    dispatch('show-settings-instructions');
  }
</script>

<div class="max-w-md mx-auto p-6">
  <div class="text-center mb-8">
    <!-- Icon -->
    <div class="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
      <svg class="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
      </svg>
    </div>

    <h2 class="text-2xl font-bold text-gray-900 mb-4">Find Your Friends</h2>
    <p class="text-gray-600 mb-6">
      Voilà needs access to your contacts to help you find friends who are already using the app and to make group planning easier.
    </p>

    <!-- Benefits -->
    <div class="text-left bg-blue-50 rounded-lg p-4 mb-6">
      <h3 class="font-semibold text-blue-900 mb-3">With contact access, you can:</h3>
      <ul class="space-y-2 text-sm text-blue-800">
        <li class="flex items-start">
          <svg class="w-4 h-4 text-blue-600 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          Find friends who are already on Voilà
        </li>
        <li class="flex items-start">
          <svg class="w-4 h-4 text-blue-600 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          Easily add friends to groups
        </li>
        <li class="flex items-start">
          <svg class="w-4 h-4 text-blue-600 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          Invite people to join Voilà
        </li>
      </ul>
    </div>

    <!-- Privacy notice -->
    <div class="text-xs text-gray-500 mb-6 p-3 bg-gray-50 rounded-lg">
      <p>🔒 <strong>Your privacy matters:</strong> Your contacts are only used to find mutual connections and are never stored on our servers or shared with others.</p>
    </div>
  </div>

  <!-- Action buttons -->
  <div class="space-y-3">
    {#if !isContactsSupportedPlatform()}
      <!-- Web version message -->
      <div class="text-center py-4">
        <p class="text-gray-600 mb-4">Contact sync is available in the mobile app</p>
        <button
          on:click={() => dispatch('permission-granted')}
          class="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Continue
        </button>
      </div>
    {:else if permissionStatus === 'loading' || isRequesting}
      <!-- Loading state -->
      <div class="py-4">
        <NativeLoading text="Requesting permission..." />
      </div>
    {:else if permissionStatus === 'granted'}
      <!-- Already granted -->
      <div class="text-center py-4">
        <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <p class="text-green-700 font-medium mb-4">Contact access granted!</p>
        <button
          on:click={() => dispatch('permission-granted')}
          class="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors"
        >
          Continue
        </button>
      </div>
    {:else if permissionStatus === 'denied'}
      <!-- Permission denied -->
      <div class="text-center">
        <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </div>
        <p class="text-red-700 font-medium mb-4">Contact access is required</p>
        <p class="text-sm text-gray-600 mb-4">
          To use Voilà's group features, you need to allow contact access. You can enable this in your device settings.
        </p>
        <button
          on:click={goToSettings}
          class="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors mb-3"
        >
          Open Settings
        </button>
        <button
          on:click={requestPermission}
          class="w-full bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
        >
          Try Again
        </button>
      </div>
    {:else}
      <!-- Initial request -->
      <button
        on:click={requestPermission}
        disabled={isRequesting}
        class="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {#if isRequesting}
          <svg class="animate-spin w-5 h-5 mx-auto" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
        {:else}
          Allow Contact Access
        {/if}
      </button>

      {#if skipable}
        <button
          on:click={skipPermission}
          class="w-full bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
        >
          Skip for now
        </button>
      {/if}
    {/if}
  </div>
</div> 