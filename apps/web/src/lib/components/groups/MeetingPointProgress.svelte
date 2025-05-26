<script>
  import LoadingSpinner from "$components/utils/LoadingSpinner.svelte";
  
  export let isCalculating = false;
  export let attendingMembersCount = 0;
  export let currentStep = 'analyzing'; // 'analyzing', 'geocoding', 'routing', 'optimizing', 'complete'
  
  const steps = [
    { id: 'analyzing', label: 'Analyzing member locations', icon: '📍' },
    { id: 'geocoding', label: 'Geocoding addresses', icon: '🗺️' },
    { id: 'routing', label: 'Calculating routes', icon: '🛣️' },
    { id: 'optimizing', label: 'Finding optimal point', icon: '🎯' },
    { id: 'complete', label: 'Complete', icon: '✅' }
  ];
  
  $: currentStepIndex = steps.findIndex(step => step.id === currentStep);
</script>

{#if isCalculating}
  <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
    <div class="flex items-start">
      <LoadingSpinner size="sm" color="blue" />
      <div class="ml-3 flex-1">
        <p class="text-blue-800 font-medium">Calculating optimal meeting point...</p>
        <p class="text-blue-600 text-sm mb-3">Analyzing {attendingMembersCount} attending members</p>
        
        <!-- Progress Steps -->
        <div class="space-y-2">
          {#each steps as step, index}
            <div class="flex items-center text-sm">
              <span class="text-lg mr-2">{step.icon}</span>
              <span 
                class="flex-1 {index <= currentStepIndex ? 'text-blue-700 font-medium' : 'text-blue-500'}"
              >
                {step.label}
              </span>
              {#if index < currentStepIndex}
                <span class="text-green-600 text-xs">✓</span>
              {:else if index === currentStepIndex}
                <LoadingSpinner size="sm" color="blue" />
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if} 