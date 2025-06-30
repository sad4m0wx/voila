<script>
  export let size = 'md'; // 'sm', 'md', 'lg'
  export let color = 'primary'; // 'primary', 'blue', 'gray', 'white'
  export let text = '';
  export let variant = 'spinner'; // 'spinner', 'native', 'pulse'
  
  $: sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6', 
    lg: 'w-8 h-8'
  };
  
  $: colorClasses = {
    primary: 'text-primary-500',
    blue: 'text-blue-500',
    gray: 'text-gray-500',
    white: 'text-white'
  };
  
  $: textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };
</script>

<div class="flex flex-col items-center justify-center gap-3 p-2">
  {#if variant === 'spinner'}
    <svg 
      class="animate-spin {sizeClasses[size]} {colorClasses[color]}" 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24"
    >
      <circle 
        class="opacity-25" 
        cx="12" 
        cy="12" 
        r="10" 
        stroke="currentColor" 
        stroke-width="4"
      ></circle>
      <path 
        class="opacity-75" 
        fill="currentColor" 
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
    
  {:else if variant === 'native'}
    <div class="native-spinner {sizeClasses[size]} {colorClasses[color]}">
      <svg viewBox="0 0 24 24" fill="none" class="animate-spin">
        <circle 
          cx="12" 
          cy="12" 
          r="10" 
          stroke="currentColor" 
          stroke-width="2" 
          stroke-linecap="round"
          stroke-dasharray="60 40"
          opacity="0.3"
        />
        <circle 
          cx="12" 
          cy="12" 
          r="10" 
          stroke="currentColor" 
          stroke-width="2" 
          stroke-linecap="round"
          stroke-dasharray="15 85"
          stroke-dashoffset="0"
          class="animate-spin-fast"
        />
      </svg>
    </div>
    
  <!-- Pulse Variant (new - for subtle loading states) -->
  {:else if variant === 'pulse'}
    <div class="flex space-x-1">
      <div class="w-2 h-2 bg-current rounded-full animate-bounce" style="animation-delay: 0s;"></div>
      <div class="w-2 h-2 bg-current rounded-full animate-bounce" style="animation-delay: 0.1s;"></div>
      <div class="w-2 h-2 bg-current rounded-full animate-bounce" style="animation-delay: 0.2s;"></div>
    </div>
  {/if}
  
  {#if text}
    <p class="{textSizeClasses[size]} text-secondary-600 font-medium">{text}</p>
  {/if}
</div>

<style>
  .native-spinner {
    position: relative;
  }
  
  .animate-spin-fast {
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style> 