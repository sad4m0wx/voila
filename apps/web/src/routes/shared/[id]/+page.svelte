<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  
  /** @type {import('./$types').PageData} */
  export let data;
  
  let timeoutReached = false;
  
  onMount(() => {
    if (data.attemptedAppOpen) {
      setTimeout(() => {
        timeoutReached = true;
      }, 3000);
      
      // Fallback redirect after a longer delay
      setTimeout(() => {
        goto(`/?share=${data.shareId}`, { replaceState: true });
      }, 5000);
    } else {
      // Immediate redirect if no app opening was attempted
      goto(`/?share=${data.shareId}`, { replaceState: true });
    }
  });
  
  function openInBrowser() {
    goto(`/?share=${data.shareId}`, { replaceState: true });
  }
  
  function openAppStore() {
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isAndroid = /Android/.test(userAgent);
    
    if (isIOS) {
      window.open('https://apps.apple.com/app/voila/id123456789', '_blank');
    } else if (isAndroid) {
      window.open('https://play.google.com/store/apps/details?id=com.voila.mobile', '_blank');
    }
  }
</script>

<svelte:head>
  <title>Opening Voilà App...</title>
  <meta name="robots" content="noindex">
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
  <div class="max-w-md mx-auto text-center">
    <div class="bg-white rounded-2xl shadow-xl p-8">
      <!-- App Icon -->
      <div class="relative mx-auto mb-6 w-20 h-20">
        <div class="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3">
          <span class="text-3xl">📍</span>
        </div>
        <div class="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
          <span class="text-sm">✨</span>
        </div>
      </div>
      
      <!-- Loading State -->
      {#if !timeoutReached}
        <div class="mb-6">
          <div class="animate-spin w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <h1 class="text-xl font-semibold text-gray-900 mb-2">Opening Voilà App...</h1>
          <p class="text-gray-600">
            We're trying to open the meeting point in your Voilà app.
          </p>
        </div>
      {:else}
        <!-- Fallback Options -->
        <div class="mb-6">
          <h1 class="text-xl font-semibold text-gray-900 mb-2">Having trouble opening the app?</h1>
          <p class="text-gray-600 mb-4">
            No worries! You can view this meeting point in your browser or get the app.
          </p>
          
          <div class="space-y-3">
            <button
              on:click={openInBrowser}
              class="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-xl transition-colors"
            >
              View in Browser
            </button>
            
            <button
              on:click={openAppStore}
              class="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-3 px-4 rounded-xl transition-colors"
            >
              Get the Voilà App
            </button>
          </div>
        </div>
      {/if}
      
      <!-- Footer -->
      <div class="text-xs text-gray-500 border-t pt-4">
        Share ID: {data.shareId}
      </div>
    </div>
  </div>
</div>

<style>
  .border-3 {
    border-width: 3px;
  }
</style> 