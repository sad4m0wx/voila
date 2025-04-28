<script>
  import { onMount, onDestroy } from 'svelte';
  import { initAuth } from '$stores/auth';
  
  let unsubscribe;
  
  onMount(() => {
    unsubscribe = initAuth();
  });
  
  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
    }
  });
</script>

<slot></slot>