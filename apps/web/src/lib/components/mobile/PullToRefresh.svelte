<script>
  import { createEventDispatcher, onMount } from 'svelte';
  
  export let disabled = false;
  export let threshold = 50; // pixels to pull before triggering refresh
  export let maxPull = 80; // maximum pull distance
  export let refreshing = false; // external control of refresh state
  
  const dispatch = createEventDispatcher();
  
  let container;
  let content;
  let startY = 0;
  let currentY = 0;
  let isPulling = false;
  let pullDistance = 0;
  let canRefresh = false;
  
  // Touch event handlers
  function handleTouchStart(e) {
    if (disabled || refreshing) return;
    
    // Only start pull-to-refresh if we're at the top of the page
    const scrollTop = container.scrollTop;
    if (scrollTop > 0) return;
    
    startY = e.touches[0].clientY;
    isPulling = false;
    canRefresh = false;
  }
  
  function handleTouchMove(e) {
    if (disabled || refreshing || startY === 0) return;
    
    currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;
    
    // Only proceed if pulling down and at the top
    if (deltaY <= 0 || container.scrollTop > 0) {
      resetPull();
      return;
    }
    
    // Start pulling
    if (!isPulling) {
      isPulling = true;
    }
    
    // Calculate pull distance with resistance (like Instagram)
    pullDistance = Math.min(deltaY * 0.4, maxPull);
    canRefresh = pullDistance >= threshold;
    
    // Move the content down
    updateContentPosition();
    
    // Prevent default scrolling when pulling
    if (isPulling) {
      e.preventDefault();
    }
  }
  
  function handleTouchEnd(e) {
    if (disabled || refreshing || !isPulling) {
      resetPull();
      return;
    }
    
    if (canRefresh) {
      // Trigger refresh and keep content pulled down
      dispatch('refresh');
    } else {
      // Snap back
      snapBack();
    }
    
    startY = 0;
    currentY = 0;
    isPulling = false;
  }
  
  function updateContentPosition() {
    if (!content) return;
    
    // Move content down and show spinner
    content.style.transform = `translateY(${pullDistance}px)`;
    content.style.transition = 'none';
  }
  
  function resetPull() {
    isPulling = false;
    canRefresh = false;
    pullDistance = 0;
    
    if (content) {
      content.style.transform = 'translateY(0px)';
      content.style.transition = '';
    }
  }
  
  function snapBack() {
    if (content) {
      content.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      content.style.transform = 'translateY(0px)';
      
      setTimeout(() => {
        if (content) {
          content.style.transition = '';
        }
      }, 300);
    }
  }
  
  // Watch for external refresh state changes
  $: if (refreshing && content) {
    // Keep content pulled down while refreshing
    content.style.transform = `translateY(${threshold}px)`;
    content.style.transition = 'transform 0.2s ease-out';
  } else if (!refreshing && content && !isPulling) {
    // Snap back after refresh completes
    setTimeout(() => {
      snapBack();
    }, 200);
  }
  
  onMount(() => {
    // Add touch event listeners
    if (container) {
      container.addEventListener('touchstart', handleTouchStart, { passive: true });
      container.addEventListener('touchmove', handleTouchMove, { passive: false });
      container.addEventListener('touchend', handleTouchEnd, { passive: true });
    }
    
    return () => {
      if (container) {
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('touchend', handleTouchEnd);
      }
    };
  });
</script>

<div 
  bind:this={container}
  class="pull-to-refresh-container"
  class:pulling={isPulling}
  class:refreshing
>
  <!-- Loading indicator - only visible when pulling or refreshing -->
  {#if isPulling || refreshing}
    <div class="loading-indicator" class:active={canRefresh || refreshing}>
      <div class="spinner">
        <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    </div>
  {/if}
  
  <!-- Content that gets pulled down -->
  <div bind:this={content} class="content">
    <slot />
  </div>
</div>

<style>
  .pull-to-refresh-container {
    position: relative;
    height: 100%;
    overflow-y: auto;
    overscroll-behavior-y: none; /* Prevent bounce on iOS */
    -webkit-overflow-scrolling: touch;
    background: #fafafa;
  }
  
  .loading-indicator {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    padding: 12px 0;
    opacity: 0.6;
    transition: opacity 0.2s ease;
  }
  
  .loading-indicator.active {
    opacity: 1;
  }
  
  .spinner {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    color: #666;
  }
  
  .content {
    position: relative;
    z-index: 1;
    background: white;
    min-height: 100%;
  }
  
  /* Prevent text selection during pull */
  .pulling {
    user-select: none;
    -webkit-user-select: none;
  }
  
  .pulling .content {
    pointer-events: none;
  }
  
  /* Hide scrollbar on mobile */
  .pull-to-refresh-container::-webkit-scrollbar {
    display: none;
  }
  
  .pull-to-refresh-container {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  
  /* Smooth transitions */
  .content {
    transform: translateY(0px);
    transition: transform 0.0s;
  }
  
  /* Loading state styling */
  .refreshing .loading-indicator {
    opacity: 1;
  }
  
  .refreshing .content {
    transition: transform 0.2s ease-out;
  }
</style>