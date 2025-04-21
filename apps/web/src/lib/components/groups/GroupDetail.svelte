<!-- src/lib/components/groups/GroupDetail.svelte -->
<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { goto } from '$app/navigation';
  import { 
    currentGroup, 
    updateGroupInfo, 
    deleteCurrentGroup, 
    leaveCurrentGroup, 
    isLoading 
  } from '$stores/groups';
  import { authStore } from '$stores/auth';
  
  // Props
  export let groupId;
  
  // Local state
  let isEditing = false;
  let editName = '';
  let editDescription = '';
  let showDeleteConfirm = false;
  let showLeaveConfirm = false;
  let error = null;
  
  const dispatch = createEventDispatcher();
  
  // Initialize edit form when editing starts
  $: if (isEditing && $currentGroup) {
    editName = $currentGroup.name;
    editDescription = $currentGroup.description || '';
  }
  
  // Compute user role
  $: userRole = $currentGroup && $authStore.user ? 
    $currentGroup.creatorId === $authStore.user.uid ? 'creator' :
    $currentGroup.admins.includes($authStore.user.uid) ? 'admin' :
    'member' : 'none';
  
  // Start editing
  function startEditing() {
    isEditing = true;
  }
  
  // Cancel editing
  function cancelEditing() {
    isEditing = false;
    error = null;
  }
  
  // Save changes
  async function saveChanges() {
    if (!editName.trim()) {
      error = 'Group name is required';
      return;
    }
    
    error = null;
    
    const updateData = {
      name: editName.trim(),
      description: editDescription.trim()
    };
    
    try {
      const success = await updateGroupInfo(groupId, updateData);
      
      if (success) {
        isEditing = false;
      }
    } catch (err) {
      error = err.message;
    }
  }
  
  // Delete group
  async function handleDeleteGroup() {
    try {
      const success = await deleteCurrentGroup();
      
      if (success) {
        dispatch('deleted');
        // Redirect to groups list
        goto('/groups');
      }
    } catch (err) {
      error = err.message;
      showDeleteConfirm = false;
    }
  }
  
  // Leave group
  async function handleLeaveGroup() {
    try {
      const success = await leaveCurrentGroup();
      
      if (success) {
        dispatch('left');
        // Redirect to groups list
        goto('/groups');
      }
    } catch (err) {
      error = err.message;
      showLeaveConfirm = false;
    }
  }
  
  // Format date
  function formatDate(date) {
    if (!date) return '';
    
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(date).toLocaleDateString(undefined, options);
  }
</script>

<div class="relative">
  {#if $isLoading}
    <div class="flex flex-col items-center justify-center py-8 text-gray-500">
      <div class="w-10 h-10 border-4 border-gray-200 border-t-primary-600 rounded-full animate-spin mb-4"></div>
      <p>Loading group details...</p>
    </div>
  {:else if $currentGroup}
    {#if isEditing}
      <!-- Edit Mode -->
      <div class="mt-2">
        <h2 class="text-2xl font-semibold text-gray-900 mb-6">Edit Group</h2>
        
        {#if error}
          <div class="flex items-center p-4 mb-4 text-sm text-red-700 bg-red-50 rounded-md border-l-4 border-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{error}</span>
          </div>
        {/if}
        
        <div class="mb-4">
          <label for="groupName" class="block mb-2 font-medium text-gray-700">Group Name</label>
          <input 
            type="text" 
            id="groupName" 
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" 
            bind:value={editName} 
            placeholder="Enter group name"
            required
          />
        </div>
        
        <div class="mb-4">
          <label for="groupDescription" class="block mb-2 font-medium text-gray-700">Description (optional)</label>
          <textarea 
            id="groupDescription" 
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" 
            bind:value={editDescription} 
            placeholder="What's this group about?"
            rows="3"
          ></textarea>
        </div>
        
        <div class="flex justify-between gap-4 mt-6">
          <button 
            class="px-4 py-2 font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            on:click={cancelEditing}
          >
            Cancel
          </button>
          
          <button 
            class="px-4 py-2 font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            on:click={saveChanges}
            disabled={$isLoading || !editName.trim()}
          >
            {#if $isLoading}
              <div class="inline-block w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Saving...</span>
            {:else}
              <span>Save Changes</span>
            {/if}
          </button>
        </div>
      </div>
    {:else}
      <!-- View Mode -->
      <div class="mb-6">
        <div class="flex flex-col sm:flex-row justify-between items-start mb-4">
          <div>
            <h1 class="text-3xl font-bold text-gray-900">{$currentGroup.name}</h1>
            
            <div class="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <div class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <span>{$currentGroup.members.length} {$currentGroup.members.length === 1 ? 'member' : 'members'}</span>
              </div>
              
              <div class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span>Created {formatDate($currentGroup.createdAt)}</span>
              </div>
              
              <div class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span>Your role: {userRole.charAt(0).toUpperCase() + userRole.slice(1)}</span>
              </div>
            </div>
          </div>
          
          {#if userRole !== 'none' && (userRole === 'creator' || userRole === 'admin')}
            <button 
              class="flex items-center mt-2 sm:mt-0 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              on:click={startEditing}
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
              </svg>
              <span>Edit</span>
            </button>
          {/if}
        </div>
        
        {#if $currentGroup.description}
          <p class="mt-2 text-gray-600">{$currentGroup.description}</p>
        {/if}
      </div>
      
      <div class="flex flex-wrap gap-4 mt-6 pt-4 border-t border-gray-200">
        {#if userRole === 'creator'}
          <button 
            class="flex items-center px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            on:click={() => showDeleteConfirm = true}
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18"></path>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            <span>Delete Group</span>
          </button>
        {:else if userRole === 'member' || userRole === 'admin'}
          <button 
            class="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            on:click={() => showLeaveConfirm = true}
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Leave Group</span>
          </button>
        {/if}
      </div>
      
      {#if error}
        <div class="flex items-center p-4 mt-4 text-sm text-red-700 bg-red-50 rounded-md border-l-4 border-red-500">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{error}</span>
        </div>
      {/if}
    {/if}
    
    <!-- Confirmation Modals -->
    {#if showDeleteConfirm}
      <div class="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center" on:click={() => showDeleteConfirm = false}>
        <div class="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4 w-full" on:click|stopPropagation>
          <h3 class="text-xl font-medium text-gray-900 mb-4">Delete Group?</h3>
          <p class="text-gray-600 mb-6">Are you sure you want to delete this group? This action cannot be undone and all group data will be permanently lost.</p>
          
          <div class="flex justify-end gap-4">
            <button 
              class="px-4 py-2 font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              on:click={() => showDeleteConfirm = false}
            >
              Cancel
            </button>
            <button 
              class="px-4 py-2 font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
              on:click={handleDeleteGroup}
              disabled={$isLoading}
            >
              {#if $isLoading}
                <div class="inline-block w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Deleting...</span>
              {:else}
                <span>Yes, Delete Group</span>
              {/if}
            </button>
          </div>
        </div>
      </div>
    {/if}
    
    {#if showLeaveConfirm}
      <div class="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center" on:click={() => showLeaveConfirm = false}>
        <div class="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4 w-full" on:click|stopPropagation>
          <h3 class="text-xl font-medium text-gray-900 mb-4">Leave Group?</h3>
          <p class="text-gray-600 mb-6">Are you sure you want to leave this group? You'll need an invitation to rejoin.</p>
          
          <div class="flex justify-end gap-4">
            <button 
              class="px-4 py-2 font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              on:click={() => showLeaveConfirm = false}
            >
              Cancel
            </button>
            <button 
              class="px-4 py-2 font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              on:click={handleLeaveGroup}
              disabled={$isLoading}
            >
              {#if $isLoading}
                <div class="inline-block w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Leaving...</span>
              {:else}
                <span>Yes, Leave Group</span>
              {/if}
            </button>
          </div>
        </div>
      </div>
    {/if}
  {:else}
    <div class="flex flex-col items-center justify-center py-10 text-center">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-16 h-16 mb-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <h2 class="mb-2 text-xl font-medium text-gray-900">Group Not Found</h2>
      <p class="mb-6 text-gray-600">The group you're looking for doesn't exist or you don't have access to it.</p>
      <a href="/groups" class="px-4 py-2 font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">Go to My Groups</a>
    </div>
  {/if}
</div>