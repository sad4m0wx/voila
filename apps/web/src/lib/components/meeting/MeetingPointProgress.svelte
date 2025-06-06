<script>
  import LoadingSpinner from "$components/utils/LoadingSpinner.svelte";
  
  export let isCalculating = false;
  export let addressCount = 0;
  export let currentStep = 'analyzing'; // 'analyzing', 'geocoding', 'routing', 'optimizing', 'complete'
  
  const steps = [
    { id: 'analyzing', label: 'Analyzing locations', icon: '📍', description: 'Processing your addresses' },
    { id: 'geocoding', label: 'Geocoding addresses', icon: '🗺️', description: 'Converting to coordinates' },
    { id: 'routing', label: 'Calculating routes', icon: '🛣️', description: 'Finding optimal paths' },
    { id: 'optimizing', label: 'Finding optimal point', icon: '🎯', description: 'Determining best meeting spot' },
    { id: 'complete', label: 'Complete', icon: '✅', description: 'Meeting point found!' }
  ];
  
  $: currentStepIndex = steps.findIndex(step => step.id === currentStep);
  $: currentStepData = steps[currentStepIndex] || steps[0];
</script>

{#if isCalculating}
  <div class="card card-gradient p-6 mb-6 animate-fade-in">
    <div class="flex items-start">
      <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-xl mr-4 shadow-md animate-pulse-soft">
        🎯
      </div>
      <div class="flex-1">
        <h3 class="text-lg font-bold text-secondary-800 mb-1">Finding Your Perfect Meeting Spot</h3>
        <p class="text-secondary-600 text-sm mb-4">Analyzing {addressCount} locations to find the optimal meeting point</p>
        
        <!-- Current Step Highlight -->
        <div class="bg-primary-50 rounded-xl p-4 mb-4">
          <div class="flex items-center">
            <span class="text-2xl mr-3 animate-bounce-subtle">{currentStepData.icon}</span>
            <div class="flex-1">
              <div class="flex items-center justify-between">
                <span class="font-semibold text-primary-800">{currentStepData.label}</span>
                <LoadingSpinner size="sm" color="primary" />
              </div>
              <p class="text-primary-600 text-sm mt-1">{currentStepData.description}</p>
            </div>
          </div>
        </div>
        
        <!-- Progress Steps -->
        <div class="space-y-3">
          {#each steps as step, index}
            <div class="flex items-center">
              <div class="w-8 h-8 rounded-full flex items-center justify-center mr-3 {
                index < currentStepIndex ? 'bg-success-100 text-success-700' :
                index === currentStepIndex ? 'bg-primary-100 text-primary-700' :
                'bg-secondary-100 text-secondary-400'
              }">
                {#if index < currentStepIndex}
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                {:else if index === currentStepIndex}
                  <div class="w-2 h-2 rounded-full bg-current animate-pulse"></div>
                {:else}
                  <div class="w-2 h-2 rounded-full bg-current opacity-30"></div>
                {/if}
              </div>
              <span class="text-sm {
                index < currentStepIndex ? 'text-success-700 font-medium' :
                index === currentStepIndex ? 'text-primary-700 font-medium' :
                'text-secondary-500'
              }">
                {step.label}
              </span>
            </div>
          {/each}
        </div>
        
        <!-- Progress Bar -->
        <div class="mt-4">
          <div class="flex justify-between text-xs text-secondary-600 mb-1">
            <span>Progress</span>
            <span>{Math.round(((currentStepIndex + 1) / steps.length) * 100)}%</span>
          </div>
          <div class="w-full bg-secondary-200 rounded-full h-2">
            <div 
              class="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full transition-all duration-500 ease-out"
              style="width: {((currentStepIndex + 1) / steps.length) * 100}%"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if} 