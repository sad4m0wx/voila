<!-- Native-style bottom sheet -->
<script>
  import { createEventDispatcher, onMount, tick } from 'svelte';
  
  
  export let open = false;
  export let snapPoints = [0.3, 0.6, 0.9]; // Percentage of screen height
  export let initialSnap = 1; // Index of initial snap point
  export let allowSwipeDown = true;
  export let showHandle = true;
  
  const dispatch = createEventDispatcher();
  
  let container;
  let content;
  let backdrop;
  let isDragging = false;
  let startY = 0;
  let currentY = 0;
  let currentSnapIndex = initialSnap;
  let screenHeight = 0;
  
  $: if (open && container) {
    animateToSnap(currentSnapIndex);
  }
  
  onMount(() => {
    screenHeight = window.innerHeight;
    
    const handleResize = () => {
      screenHeight = window.innerHeight;
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });
  
  function onTouchStart(e) {
    if (!allowSwipeDown) return;
    
    startY = e.touches[0].clientY;
    isDragging = true;
    content.style.transition = 'none';
  }
  
  function onTouchMove(e) {
    if (!isDragging) return;
    
    const deltaY = e.touches[0].clientY - startY;
    const currentSnapHeight = screenHeight * snapPoints[currentSnapIndex];
    const newPosition = Math.max(0, currentSnapHeight - deltaY);
    
    // Add resistance when pulling beyond bounds
    let finalPosition = newPosition;
    if (newPosition > screenHeight * snapPoints[snapPoints.length - 1]) {
      const excess = newPosition - screenHeight * snapPoints[snapPoints.length - 1];
      finalPosition = screenHeight * snapPoints[snapPoints.length - 1] + excess * 0.3;
    }
    
    content.style.transform = `translateY(${screenHeight - finalPosition}px)`;
  }
  
  function onTouchEnd(e) {
    if (!isDragging) return;
    
    isDragging = false;
    content.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
    
    const deltaY = e.changedTouches[0].clientY - startY;
    const threshold = 50;
    
    // Determine next snap point
    let newSnapIndex = currentSnapIndex;
    
    if (deltaY > threshold && currentSnapIndex > 0) {
      newSnapIndex = currentSnapIndex - 1;
    } else if (deltaY < -threshold && currentSnapIndex < snapPoints.length - 1) {
      newSnapIndex = currentSnapIndex + 1;
    }
    
    // Close if swiping down from first snap point
    if (deltaY > threshold && currentSnapIndex === 0) {
      close();
      return;
    }
    

    
    currentSnapIndex = newSnapIndex;
    animateToSnap(currentSnapIndex);
  }
  
  function animateToSnap(snapIndex) {
    if (!content) return;
    
    const targetHeight = screenHeight * snapPoints[snapIndex];
    content.style.transform = `translateY(${screenHeight - targetHeight}px)`;
  }
  
  function close() {
    open = false;
    dispatch('close');
  }
  
  function onBackdropClick() {
    close();
  }
  
  // Handle snap point changes
  export function snapTo(index) {
    if (index >= 0 && index < snapPoints.length) {
      currentSnapIndex = index;
      animateToSnap(index);
    }
  }
</script>

{#if open}
  <!-- Backdrop -->
  <div 
    class="backdrop"
    class:visible={open}
    bind:this={backdrop}
    on:click={onBackdropClick}
    on:keydown={(e) => e.key === 'Escape' && close()}
    role="button"
    tabindex="0"
  ></div>
  
  <!-- Bottom Sheet Container -->
  <div 
    class="bottom-sheet"
    bind:this={container}
  >
    <div 
      class="content"
      bind:this={content}
      on:touchstart|passive={onTouchStart}
      on:touchmove|passive={onTouchMove}
      on:touchend|passive={onTouchEnd}
    >
      {#if showHandle}
        <div class="handle-container">
          <div class="handle"></div>
        </div>
      {/if}
      
      <div class="sheet-content">
        <slot />
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999;
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  
  .backdrop.visible {
    opacity: 1;
  }
  
  .bottom-sheet {
    position: fixed;
    inset: 0;
    z-index: 1000;
    pointer-events: none;
  }
  
  .content {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: white;
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
    pointer-events: auto;
    transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
    transform: translateY(100%);
    max-height: 95vh;
  }
  
  .handle-container {
    padding: 12px 0 8px;
    display: flex;
    justify-content: center;
  }
  
  .handle {
    width: 36px;
    height: 4px;
    background: #d1d5db;
    border-radius: 2px;
  }
  
  .sheet-content {
    padding: 0 20px 20px;
    padding-bottom: max(20px, env(safe-area-inset-bottom));
    overflow-y: auto;
    max-height: calc(95vh - 60px);
  }
  
  /* iOS-style momentum scrolling */
  .sheet-content {
    -webkit-overflow-scrolling: touch;
    overflow-scrolling: touch;
  }
</style> 