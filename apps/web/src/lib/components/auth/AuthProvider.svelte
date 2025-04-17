<!-- apps/web/src/lib/components/auth/AuthProvider.svelte -->
<script>
    import { onMount, onDestroy } from 'svelte';
    import { authStore, initAuth } from '$lib/stores/auth';
    
    // State
    let unsubscribe;
    
    onMount(() => {
      // Initialize the auth listener
      unsubscribe = initAuth();
    });
    
    onDestroy(() => {
      // Clean up subscription when component is destroyed
      if (unsubscribe) {
        unsubscribe();
      }
    });
  </script>
  
  <slot {$authStore}></slot>
  
  
  