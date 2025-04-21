<!-- src/lib/components/groups/GroupsList.svelte -->
<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { groups, loadUserGroups, isLoading } from '$stores/groups';
  
  // Props
  export let showCreateButton = true;
  export let showEmptyState = true;
  export let title = "My Groups";
  
  onMount(() => {
    loadUserGroups();
  });
  
  // Navigate to group details
  function viewGroup(groupId) {
    goto(`/groups/${groupId}`);
  }
  
  // Navigate to create group page
  function createGroup() {
    goto('/groups/create');
  }
  
  // Format date
  function formatDate(date) {
    if (!date) return '';
    
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(date).toLocaleDateString(undefined, options);
  }
</script>

<div class="mb-6">
  <div class="flex justify-between items-center mb-4">
    <h3 class="text-xl font-semibold text-gray-900">{title}</h3>
    
    {#if showCreateButton}
      <button 
        class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors" 
        on:click={createGroup}
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          <line x1="19.5" y1="7.5" x2="19.5" y2="7.5"></line>
          <line x1="19.5" y1="7.5" x2="19.5" y2="7.5"></line>
        </svg>
        <span>Create Group</span>
      </button>
    {/if}
  </div>
  
  {#if $isLoading}
    <div class="flex flex-col items-center justify-center py-8 text-gray-500">
      <div class="w-10 h-10 border-4 border-gray-200 border-t-primary-600 rounded-full animate-spin mb-4"></div>
      <p>Loading groups...</p>
    </div>
  {:else if $groups.length === 0 && showEmptyState}
    <div class="flex flex-col items-center justify-center py-8 text-center text-gray-500">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 mb-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
      <p>You don't have any groups yet.</p>
      <button 
        class="px-4 py-2 mt-4 text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors" 
        on:click={createGroup}
      >
        Create Your First Group
      </button>
    </div>
  {:else}
    <ul class="space-y-3">
      {#each $groups as group (group.id)}
        <li 
          class="flex items-center justify-between p-4 bg-gray-50 rounded-md cursor-pointer hover:bg-primary-50 hover:transform hover:-translate-y-0.5 transition-all duration-200 hover:shadow-sm"
          on:click={() => viewGroup(group.id)}
        >
          <div>
            <h4 class="text-base font-medium text-gray-900 group-hover:text-primary-600">{group.name}</h4>
            <p class="flex items-center gap-2 mt-1 text-xs text-gray-500">
              <span>{group.members.length} {group.members.length === 1 ? 'member' : 'members'}</span>
              <span class="text-gray-300">•</span>
              <span>Created {formatDate(group.createdAt)}</span>
            </p>
            {#if group.description}
              <p class="mt-1 text-sm text-gray-600 line-clamp-2">{group.description}</p>
            {/if}
          </div>
          
          <div class="text-gray-400 hover:text-primary-500 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>