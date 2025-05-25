<!-- apps/web/src/lib/components/SlideToConfirm.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  
  export let text = "slide to confirm";
  export let confirmText = "confirmed!";
  export let disabled = false;
  
  const dispatch = createEventDispatcher();
  
  let slider;
  let track;
  let isDragging = false;
  let startX = 0;
  let currentX = 0;
  let sliderWidth = 0;
  let trackWidth = 0;
  let confirmed = false;
  
  $: progress = trackWidth > 0 ? Math.min(currentX / (trackWidth - sliderWidth), 1) : 0;
  $: sliderStyle = `transform: translateX(${currentX}px);`;
  
  function handleStart(e) {
    if (disabled || confirmed) return;
    
    isDragging = true;
    startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    sliderWidth = slider.offsetWidth;
    trackWidth = track.offsetWidth;
    
    // Add event listeners to window to handle dragging outside the element
    if (e.type.includes('mouse')) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
    } else {
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
    }
  }
  
  function handleMove(e) {
    if (!isDragging) return;
    
    e.preventDefault();
    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const deltaX = clientX - startX;
    const maxX = trackWidth - sliderWidth;
    
    currentX = Math.max(0, Math.min(deltaX, maxX));
    
    // Check if we've reached the end
    if (currentX >= maxX * 0.95) {
      handleConfirm();
    }
  }
  
  function handleEnd() {
    if (!isDragging) return;
    
    isDragging = false;
    
    // Remove event listeners
    window.removeEventListener('mousemove', handleMove);
    window.removeEventListener('mouseup', handleEnd);
    window.removeEventListener('touchmove', handleMove);
    window.removeEventListener('touchend', handleEnd);
    
    // If not confirmed, animate back to start
    if (!confirmed) {
      animateBack();
    }
  }
  
  function animateBack() {
    const duration = 300;
    const start = currentX;
    const startTime = performance.now();
    
    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      currentX = start * (1 - easeOut);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }
    
    requestAnimationFrame(animate);
  }
  
  function handleConfirm() {
    if (confirmed) return;
    
    confirmed = true;
    currentX = trackWidth - sliderWidth;
    dispatch('confirm');
    
    // Reset after animation
    setTimeout(() => {
      confirmed = false;
      currentX = 0;
    }, 2000);
  }
  
  function reset() {
    confirmed = false;
    currentX = 0;
  }
</script>

<div 
  class="slide-to-confirm" 
  class:disabled
  class:confirmed
  bind:this={track}
>
  <div class="track-bg"></div>
  
  <div class="text-container">
    <span class="text" style="opacity: {1 - progress * 0.8}">
      {confirmed ? confirmText : text}
    </span>
  </div>
  
  <button
    class="slider"
    style={sliderStyle}
    bind:this={slider}
    on:mousedown={handleStart}
    on:touchstart={handleStart}
    disabled={disabled}
    aria-label={text}
  >
    <svg 
      class="arrow"
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="9 6 15 12 9 18"></polyline>
    </svg>
  </button>
</div>

<style>
  .slide-to-confirm {
    position: relative;
    width: 100%;
    height: 56px;
    background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
    border-radius: 28px;
    overflow: hidden;
    user-select: none;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: opacity 0.3s ease;
  }
  
  .slide-to-confirm.disabled {
    opacity: 0.5;
    pointer-events: none;
  }
  
  .slide-to-confirm.confirmed {
    background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
  }
  
  .track-bg {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, 
      transparent 0%, 
      rgba(59, 130, 246, 0.1) 50%, 
      transparent 100%
    );
    animation: shimmer 2s infinite;
  }
  
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  
  .text-container {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  
  .text {
    font-size: 16px;
    font-weight: 500;
    color: #6b7280;
    transition: opacity 0.3s ease;
    text-transform: lowercase;
    letter-spacing: 0.5px;
  }
  
  .confirmed .text {
    color: white;
  }
  
  .slider {
    position: absolute;
    left: 4px;
    top: 4px;
    width: 48px;
    height: 48px;
    background: white;
    border-radius: 24px;
    border: none;
    padding: 0;
    cursor: grab;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: box-shadow 0.2s ease;
    touch-action: none;
  }
  
  .slider:active {
    cursor: grabbing;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
  
  .arrow {
    width: 20px;
    height: 20px;
    color: #6b7280;
    transition: transform 0.2s ease;
  }
  
  .slider:active .arrow {
    transform: scale(0.9);
  }
  
  .confirmed .arrow {
    color: #22c55e;
    animation: pulse 0.5s ease;
  }
  
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.2); }
  }
</style>