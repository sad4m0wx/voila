<script>
    import { createEventDispatcher } from 'svelte';
    
    const dispatch = createEventDispatcher();
    
    export let groupName = '';
    export let groupDescription = '';
    export let isSaving = false;
    export let isAdmin = false;
    
    function handleSave() {
      if (!groupName.trim()) {
        dispatch('error', { message: 'Group name is required' });
        return;
      }
      
      dispatch('save', {
        name: groupName,
        description: groupDescription
      });
    }
  </script>
  
  {#if isAdmin}
    <div class="bg-white shadow rounded-lg p-6 mb-6">
      <h2 class="text-lg font-medium text-gray-900 mb-4">Group Information</h2>
      
      <div class="space-y-4">
        <div>
          <label for="group-name" class="block text-sm font-medium text-gray-700">
            Group Name
          </label>
          <input 
            type="text" 
            id="group-name" 
            bind:value={groupName}
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          />
        </div>
        
        <div>
          <label for="group-description" class="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea 
            id="group-description" 
            bind:value={groupDescription}
            rows="3"
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          ></textarea>
        </div>
        
        <div>
          <button
            on:click={handleSave}
            disabled={isSaving}
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {#if isSaving}
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            {:else}
              Save Changes
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}
  