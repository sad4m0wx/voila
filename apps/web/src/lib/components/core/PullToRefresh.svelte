<!-- src/lib/components/mobile/PullToRefresh.svelte -->
<script>
  import { createEventDispatcher, onMount } from 'svelte';
  
  export let disabled = false;
  export let refreshing = false;
  
  const dispatch = createEventDispatcher();
  
  let container;
  let startY = 0;
  let pulling = false;
  
  function onTouchStart(e) {
    if (disabled || refreshing || container.scrollTop > 0) return;
    startY = e.touches[0].clientY;
  }
  
  function onTouchMove(e) {
    if (disabled || refreshing || !startY || container.scrollTop > 0) return;
    
    const deltaY = e.touches[0].clientY - startY;
    if (deltaY > 50) {
      pulling = true;
      e.preventDefault();
    }
  }
  
  function onTouchEnd() {
    if (pulling) {
      dispatch('refresh');
    }
    startY = 0;
    pulling = false;
  }
  
  onMount(() => {
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    
    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
    };
  });
</script>

<div bind:this={container} class="container">
  {#if refreshing}
    <div class="spinner">
      <div class="spin"></div>
    </div>
  {/if}
  
  <slot />
</div>

<style>
  .container {
    height: 100%;
    overflow-y: auto;
    overscroll-behavior-y: none;
  }
  
  .spinner {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
  }
  
  .spin {
    width: 20px;
    height: 20px;
    border: 2px solid #ddd;
    border-top: 2px solid #666;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>