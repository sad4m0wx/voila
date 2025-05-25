<!-- apps/web/src/routes/groups/[id]/settings/+page.svelte -->
<script>
  import { onMount, getContext } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { 
    currentGroup, 
    currentGroupMembers,
    isLoading, 
    error,
    loadGroup,
    loadGroupMembers,
    updateGroupInfo,
    removeMember,
    promoteMemberToAdmin,
    demoteAdminToMember,
    deleteCurrentGroup,
    leaveCurrentGroup,
    inviteUser
  } from '$stores/groups';
  
  const { user, profile, isLoading: authLoading } = getContext('auth');

  // State
  let editName = '';
  let editDescription = '';
  let inviteEmail = '';
  let isInviting = false;
  let isSaving = false;
  let showDeleteConfirm = false;
  let showLeaveConfirm = false;
  let successMessage = '';
  
  // Get group ID from URL
  const groupId = $page.params.id;
  
  onMount(async () => {
    if (!$user && !$authLoading) {
      goto('/auth/login?redirect=' + $page.url.pathname);
      return;
    }
    
    // Load group data
    await loadGroup(groupId);
    await loadGroupMembers(groupId);
    
    // Initialize form values
    if ($currentGroup) {
      editName = $currentGroup.name;
      editDescription = $currentGroup.description || '';
    }
  });
  
  // Check if current user is admin
  $: isAdmin = $currentGroup?.admins?.includes($user?.uid);
  $: isCreator = $currentGroup?.creatorId === $user?.uid;
  
  // Save group info
  async function handleSaveInfo() {
    if (!editName.trim()) {
      $error = 'Group name is required';
      return;
    }
    
    isSaving = true;
    
    const success = await updateGroupInfo(groupId, {
      name: editName,
      description: editDescription
    });
    
    if (success) {
      successMessage = 'Group information updated';
      setTimeout(() => successMessage = '', 3000);
    }
    
    isSaving = false;
  }
  
  // Invite member
  async function handleInvite() {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      $error = 'Please enter a valid email address';
      return;
    }
    isInviting = true;
    const success = await inviteUser(inviteEmail);
    if (success) {
      inviteEmail = '';
      successMessage = 'Invitation sent!';
      setTimeout(() => successMessage = '', 3000);
    }
    isInviting = false;
  }
  
  // Delete group
  async function handleDeleteGroup() {
    const success = await deleteCurrentGroup();
    
    if (success) {
      goto('/groups');
    }
  }
  
  // Leave group
  async function handleLeaveGroup() {
    const success = await leaveCurrentGroup();
    
    if (success) {
      goto('/groups');
    }
  }
</script>

<svelte:head>
  <title>Group Settings | Voilà!</title>
</svelte:head>

<main class="min-h-screen bg-gray-50">
  {#if $isLoading}
    <div class="flex justify-center items-center h-screen">
      <svg class="animate-spin h-10 w-10 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>
  {:else if $currentGroup}
    <!-- Header -->
    <header class="bg-white shadow-sm">
      <div class="px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <div class="flex items-center">
            <a href="/groups/{groupId}" class="mr-4 text-gray-400 hover:text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </a>
            <h1 class="text-xl font-semibold text-gray-900">Group Settings</h1>
          </div>
        </div>
      </div>
    </header>
    
    <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {#if error}
        <div class="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm text-red-700">{typeof error === 'string' ? error : JSON.stringify(error)+'this is not working'}</p>
            </div>
          </div>
        </div>
      {/if}
      
      {#if successMessage}
        <div class="bg-green-50 border-l-4 border-green-400 p-4 mb-6">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm text-green-700">{successMessage}</p>
            </div>
          </div>
        </div>
      {/if}
      
      <!-- Group Information -->
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
                bind:value={editName}
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label for="group-description" class="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea 
                id="group-description" 
                bind:value={editDescription}
                rows="3"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              ></textarea>
            </div>
            
            <div>
              <button
                on:click={handleSaveInfo}
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
      
      <!-- Invite Members -->
      <div class="bg-white shadow rounded-lg p-6 mb-6">
        <h2 class="text-lg font-medium text-gray-900 mb-4">Invite Members</h2>
        <div class="flex gap-2 mb-2">
          <input 
            type="email" 
            bind:value={inviteEmail}
            placeholder="Enter email address"
            class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          />
          <button
            on:click={handleInvite}
            disabled={isInviting}
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {#if isInviting}
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sending...
            {:else}
              Send Invite
            {/if}
          </button>
        </div>
      </div>
      
      <!-- Member Management -->
      {#if isAdmin}
        <div class="bg-white shadow rounded-lg p-6 mb-6">
          <h2 class="text-lg font-medium text-gray-900 mb-4">Members</h2>
          
          <div class="space-y-3">
            {#each $currentGroupMembers as member (member.id)}
              <div class="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div>
                  <p class="text-sm font-medium text-gray-900">
                    {member.displayName}
                    {#if member.id === $user?.uid}
                      <span class="text-xs text-gray-500 ml-1">(You)</span>
                    {/if}
                  </p>
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
                
                {#if member.id !== $user?.uid && !member.isCreator}
                  <div class="flex gap-2">
                    {#if member.isAdmin}
                      <button
                        on:click={() => demoteAdminToMember(member.id)}
                        class="text-xs text-gray-600 hover:text-gray-900"
                      >
                        Remove Admin
                      </button>
                    {:else}
                      <button
                        on:click={() => promoteMemberToAdmin(member.id)}
                        class="text-xs text-primary-600 hover:text-primary-700"
                      >
                        Make Admin
                      </button>
                    {/if}
                    <button
                      on:click={() => removeMember(member.id)}
                      class="text-xs text-red-600 hover:text-red-700"
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
      
      <!-- Danger Zone -->
      <div class="bg-white shadow rounded-lg p-6">
        <h2 class="text-lg font-medium text-red-900 mb-4">Danger Zone</h2>
        
        <div class="space-y-4">
          {#if isCreator}
            <div>
              <p class="text-sm text-gray-600 mb-2">
                Permanently delete this group and all its data. This action cannot be undone.
              </p>
              <button
                on:click={() => showDeleteConfirm = true}
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Delete Group
              </button>
            </div>
          {:else}
            <div>
              <p class="text-sm text-gray-600 mb-2">
                Leave this group. You'll need to be invited again to rejoin.
              </p>
              <button
                on:click={() => showLeaveConfirm = true}
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Leave Group
              </button>
            </div>
          {/if}
        </div>
      </div>
    </div>
    
    <!-- Delete Confirmation Modal -->
    {#if showDeleteConfirm}
      <div class="fixed z-10 inset-0 overflow-y-auto">
        <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
          
          <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
            <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div class="sm:flex sm:items-start">
                <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                  <svg class="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 class="text-lg leading-6 font-medium text-gray-900">
                    Delete Group
                  </h3>
                  <div class="mt-2">
                    <p class="text-sm text-gray-500">
                      Are you sure you want to delete this group? This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                on:click={handleDeleteGroup}
                class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Delete
              </button>
              <button
                type="button"
                on:click={() => showDeleteConfirm = false}
                class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}
    
    <!-- Leave Confirmation Modal -->
    {#if showLeaveConfirm}
      <div class="fixed z-10 inset-0 overflow-y-auto">
        <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
          
          <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
            <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div class="sm:flex sm:items-start">
                <div class="mt-3 text-center sm:mt-0 sm:text-left">
                  <h3 class="text-lg leading-6 font-medium text-gray-900">
                    Leave Group
                  </h3>
                  <div class="mt-2">
                    <p class="text-sm text-gray-500">
                      Are you sure you want to leave this group? You'll need to be invited again to rejoin.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                on:click={handleLeaveGroup}
                class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Leave
              </button>
              <button
                type="button"
                on:click={() => showLeaveConfirm = false}
                class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</main>