<script>
    import { onMount, onDestroy, setContext } from 'svelte';
    import { googleMapsService } from '$services/map';
    
    // Props
    export let apiKey = import.meta.env.VITE_MAPS_BROWSER_KEY;
    
    // State
    let isLoading = true;
    let error = null;
    
    // Create contexts to provide the map service to child components
    setContext('mapService', googleMapsService);
    
    onMount(async () => {
      try {
        // Initialize the map service
        await googleMapsService.initialize(apiKey);
        isLoading = false;
      } catch (err) {
        console.error('Error initializing map service:', err);
        error = err.message;
        isLoading = false;
      }
    });
    
    // Dispatch events to match the original component's API
    function handleReady() {
      dispatch('ready');
    }
    
    function handleError(e) {
      dispatch('error', e.detail);
    }
  </script>
  
  {#if isLoading}
    <slot name="loading"></slot>
  {:else if error}
    <slot name="error" {error}></slot>
  {:else}
    <slot></slot>
    <svelte:component this={onMount} on:mount={handleReady} />
  {/if}