<script>
    import { createEventDispatcher } from 'svelte';
    
    const dispatch = createEventDispatcher();
    
    export let members = [];
    export let currentUserId = '';
    export let isAdmin = false;
    
    function handlePromoteToAdmin(memberId) {
      dispatch('promote-to-admin', { memberId });
    }
    
    function handleDemoteFromAdmin(memberId) {
      dispatch('demote-from-admin', { memberId });
    }
    
    function handleRemoveMember(memberId) {
      dispatch('remove-member', { memberId });
    }
  </script>
  
  {#if isAdmin}
    <div class="bg-white shadow rounded-lg p-6 mb-6">
      <h2 class="text-lg font-medium text-gray-900 mb-4">Members</h2>
      
      <div class="space-y-3">
        {#each members as member (member.id)}
          <div class="flex items-center justify-between p-3 rounded-lg bg-gray-50">
            <div class="flex items-center space-x-3">
              <div class="text-2xl">
                {#if member.photoURL}
                  <img src={member.photoURL} alt={member.displayName} class="w-10 h-10 rounded-full" />
                {:else}
                  <div class="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium">
                    {member.displayName ? member.displayName.charAt(0).toUpperCase() : '?'}
                  </div>
                {/if}
              </div>
              
              <div class="flex-1">
                <div class="flex items-center space-x-2">
                  <h3 class="font-medium text-gray-900">
                    {member.displayName}
                    {#if member.id === currentUserId}
                      <span class="text-xs text-gray-500 ml-1">(You)</span>
                    {/if}
                  </h3>
                </div>
                <p class="text-xs text-gray-500">
                  {#if member.isCreator}
                    Owner
                  {:else if member.isAdmin}
                    Admin
                  {:else}
                    Member
                  {/if}
                </p>
              </div>
            </div>
            
            {#if member.id !== currentUserId && !member.isCreator}
              <div class="flex items-center space-x-2">
                {#if member.isAdmin}
                  <button
                    on:click={() => handleDemoteFromAdmin(member.id)}
                    class="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Remove Admin
                  </button>
                {:else}
                  <button
                    on:click={() => handlePromoteToAdmin(member.id)}
                    class="text-sm text-primary-600 hover:text-primary-700"
                  >
                    Make Admin
                  </button>
                {/if}
                <button
                  on:click={() => handleRemoveMember(member.id)}
                  class="text-sm text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
  