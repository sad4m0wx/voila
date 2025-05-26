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
  
  import GroupInfoEditor from '$components/groups/GroupInfoEditor.svelte';
  import GroupMemberManager from '$components/groups/GroupMemberManager.svelte';
  import GroupInviteForm from '$components/groups/GroupInviteForm.svelte';
  
  const { user, profile, isLoading: authLoading } = getContext('auth');

  // State
  let isSaving = false;
  let isInviting = false;
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
  });
  
  // Check if current user is admin
  $: isAdmin = $currentGroup?.admins?.includes($user?.uid);
  $: isCreator = $currentGroup?.creatorId === $user?.uid;
  
  // Save group info
  async function handleSaveInfo(event) {
    isSaving = true;
    
    const success = await updateGroupInfo(groupId, event.detail);
    
    if (success) {
      successMessage = 'Group information updated';
      setTimeout(() => successMessage = '', 3000);
    }
    
    isSaving = false;
  }
  
  // Invite member
  async function handleInvite(event) {
    isInviting = true;
    const success = await inviteUser(event.detail.email);
    if (success) {
      successMessage = 'Invitation sent!';
      setTimeout(() => successMessage = '', 3000);
    }
    isInviting = false;
  }
  
  // Member management
  async function handlePromoteToAdmin(event) {
    await promoteMemberToAdmin(event.detail.memberId);
  }
  
  async function handleDemoteFromAdmin(event) {
    await demoteAdminToMember(event.detail.memberId);
  }
  
  async function handleRemoveMember(event) {
    await removeMember(event.detail.memberId);
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
  
  function handleError(event) {
    $error = event.detail.message;
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
      {#if $error}
        <div class="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <p class="text-sm text-red-700">{$error}</p>
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
      <GroupInfoEditor 
        groupName={$currentGroup.name}
        groupDescription={$currentGroup.description || ''}
        {isSaving}
        {isAdmin}
        on:save={handleSaveInfo}
        on:error={handleError}
      />
      
      <!-- Invite Members -->
      <GroupInviteForm 
        {isInviting}
        on:invite-user={handleInvite}
        on:error={handleError}
      />
      
      <!-- Member Management -->
      <GroupMemberManager 
        members={$currentGroupMembers}
        currentUserId={$user?.uid}
        {isAdmin}
        on:promote-to-admin={handlePromoteToAdmin}
        on:demote-from-admin={handleDemoteFromAdmin}
        on:remove-member={handleRemoveMember}
      />
      
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
    
    <!-- Confirmation Modals would go here - keeping them simple for now -->
  {/if}
</main>