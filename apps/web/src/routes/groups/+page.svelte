<!-- src/routes/groups/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Navbar from '$lib/components/Navbar.svelte';
  import { authStore } from '$stores/auth';
  import { 
    groups, 
    groupInvites,
    isLoading,
    error as groupsError,
    loadUserGroups,
    loadGroupInvites,
    createNewGroup,
    acceptInvite,
    declineInvite
  } from '$stores/groups';
  
  let error = null;
  let showCreateGroupModal = false;
  
  // Form state for create group
  let newGroupName = '';
  let newGroupDescription = '';
  let isCreating = false;
  let createError = null;
  
  onMount(async () => {
    // Check if user is authenticated
    if (!$authStore.user) {
      goto('/auth/login?redirect=/groups');
      return;
    }
    
    // Load real data
    try {
      await loadUserGroups();
      await loadGroupInvites();
    } catch (err) {
      error = err.message;
    }
  });
  
  // Subscribe to store errors
  $: error = $groupsError || error;
  
  function openCreateGroupModal() {
    newGroupName = '';
    newGroupDescription = '';
    createError = null;
    showCreateGroupModal = true;
  }
  
  function closeCreateGroupModal() {
    showCreateGroupModal = false;
  }
  
  async function handleCreateGroup() {
    if (!newGroupName.trim()) {
      createError = 'Group name is required';
      return;
    }
    
    isCreating = true;
    createError = null;
    
    try {
      const groupData = {
        name: newGroupName,
        description: newGroupDescription,
      };
      
      await createNewGroup(groupData);
      closeCreateGroupModal();
    } catch (err) {
      createError = err.message || 'Failed to create group';
    } finally {
      isCreating = false;
    }
  }
  
  function viewGroup(groupId) {
    goto(`/groups/${groupId}`);
  }
  
  async function handleAcceptInvite(inviteId) {
    try {
      await acceptInvite(inviteId);
    } catch (err) {
      error = err.message;
    }
  }
  
  async function handleDeclineInvite(inviteId) {
    try {
      await declineInvite(inviteId);
    } catch (err) {
      error = err.message;
    }
  }
</script>

<svelte:head>
  <title>Groups | Voilà!</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <Navbar />
  
  <main class="pt-24 pb-12">
    <div class="container mx-auto px-4">
      <div class="max-w-3xl mx-auto">
        <div class="flex justify-between items-center mb-6">
          <h1 class="text-3xl font-bold text-gray-900">Groups</h1>
          <button
            on:click={openCreateGroupModal}
            class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none"
          >
            Create Group
          </button>
        </div>
        
        {#if $isLoading}
          <div class="flex justify-center py-12">
            <svg class="animate-spin h-10 w-10 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        {:else if error}
          <div class="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        {:else}
          <!-- Group Invites Section -->
          {#if $groupInvites.length > 0}
            <div class="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 class="text-lg font-medium text-gray-900 mb-4">Group Invitations</h2>
              <ul class="divide-y divide-gray-200">
                {#each $groupInvites as invite (invite.id)}
                  <li class="py-4">
                    <div class="flex justify-between items-start">
                      <div>
                        <h3 class="text-sm font-medium text-gray-900">{invite.groupName}</h3>
                        <p class="text-sm text-gray-500 mt-1">Invited by {invite.inviterName}</p>
                        {#if invite.message}
                          <p class="text-sm italic text-gray-500 mt-2">"{invite.message}"</p>
                        {/if}
                      </div>
                      <div class="flex space-x-2">
                        <button
                          on:click={() => handleAcceptInvite(invite.id)}
                          class="px-3 py-1 bg-primary-100 text-primary-700 rounded-md text-sm font-medium hover:bg-primary-200"
                        >
                          Accept
                        </button>
                        <button
                          on:click={() => handleDeclineInvite(invite.id)}
                          class="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
          
          <!-- Groups List -->
          <div class="bg-white rounded-lg shadow-md p-6">
            <h2 class="text-lg font-medium text-gray-900 mb-4">My Groups</h2>
            
            {#if $groups.length === 0}
              <div class="text-center py-12">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 class="text-xl font-medium text-gray-900 mb-2">No groups yet</h3>
                <p class="text-gray-500 mb-6">Create a group to find meeting spots together</p>
                <button
                  on:click={openCreateGroupModal}
                  class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none"
                >
                  Create Your First Group
                </button>
              </div>
            {:else}
              <ul class="divide-y divide-gray-200">
                {#each $groups as group (group.id)}
                  <li class="py-4">
                    <button
                      on:click={() => viewGroup(group.id)}
                      class="w-full text-left"
                    >
                      <div class="flex justify-between items-center">
                        <div>
                          <h3 class="text-lg font-medium text-gray-900">{group.name}</h3>
                          {#if group.description}
                            <p class="text-sm text-gray-500 mt-1">{group.description}</p>
                          {/if}
                          <p class="text-xs text-gray-500 mt-2">
                            {group.members?.length || 0} members
                            {#if group.createdAt}
                              • Created {new Date(group.createdAt).toLocaleDateString()}
                            {/if}
                          </p>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                        </svg>
                      </div>
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </main>
  
  <!-- Create Group Modal -->
  {#if showCreateGroupModal}
    <div class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <!-- Background overlay -->
        <div
          class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          on:click={closeCreateGroupModal}
          aria-hidden="true"
        ></div>

        <!-- Modal panel -->
        <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div class="sm:flex sm:items-start">
              <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                  Create a New Group
                </h3>
                <div class="mt-4 space-y-4">
                  {#if createError}
                    <div class="bg-red-50 border-l-4 border-red-500 p-4">
                      <div class="flex">
                        <div class="flex-shrink-0">
                          <svg class="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                          </svg>
                        </div>
                        <div class="ml-3">
                          <p class="text-sm text-red-700">{createError}</p>
                        </div>
                      </div>
                    </div>
                  {/if}

                  <div>
                    <label for="group-name" class="block text-sm font-medium text-gray-700">
                      Group Name <span class="text-red-500">*</span>
                    </label>
                    <div class="mt-1">
                      <input
                        type="text"
                        id="group-name"
                        bind:value={newGroupName}
                        placeholder="Enter group name"
                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label for="group-description" class="block text-sm font-medium text-gray-700">
                      Description (optional)
                    </label>
                    <div class="mt-1">
                      <textarea
                        id="group-description"
                        bind:value={newGroupDescription}
                        rows="3"
                        placeholder="Describe your group's purpose"
                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              on:click={handleCreateGroup}
              disabled={isCreating}
              class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
            >
              {#if isCreating}
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
              {:else}
                Create Group
              {/if}
            </button>
            <button
              type="button"
              on:click={closeCreateGroupModal}
              class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>