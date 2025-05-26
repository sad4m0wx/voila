<!-- Enhanced Group Settings Page -->
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
    addFriends,
    inviteByPhone,
    resetAttendance,
    removeMember,
    promoteMemberToAdmin,
    demoteAdminToMember,
    deleteCurrentGroup,
    leaveCurrentGroup
  } from '$stores/groups';
  
  import GroupInfoEditor from '$components/groups/GroupInfoEditor.svelte';
  import GroupMemberManager from '$components/groups/GroupMemberManager.svelte';
  import GroupInvite from '$components/groups/GroupInvite.svelte';
  
  const { user, profile, isLoading: authLoading } = getContext('auth');

  // State
  let isSaving = false;
  let isInviting = false;
  let isResettingAttendance = false;
  let showDeleteConfirm = false;
  let showLeaveConfirm = false;
  let showResetAttendanceConfirm = false;
  let successMessage = '';
  let localError = '';
  
  // Get group ID from URL
  const groupId = $page.params.id;
  
  // Check if current user is admin
  $: isAdmin = $currentGroup?.admins?.includes($user?.uid);
  $: isCreator = $currentGroup?.creatorId === $user?.uid;
  
  onMount(async () => {
    if (!$user && !$authLoading) {
      goto('/auth/login?redirect=' + $page.url.pathname);
      return;
    }
    
    // Load group data
    await loadGroup(groupId);
    await loadGroupMembers(groupId);
  });
  
  // Save group info
  async function handleSaveInfo(event) {
    isSaving = true;
    localError = '';
    
    const success = await updateGroupInfo(groupId, event.detail);
    
    if (success) {
      showSuccessMessage('Group information updated');
    } else {
      localError = $error || 'Failed to update group information';
    }
    
    isSaving = false;
  }
  
  // Handle adding friends directly to group
  async function handleInviteFriends(event) {
    const { friendIds } = event.detail;
    
    isInviting = true;
    localError = '';
    
    try {
      const results = await addFriends(groupId, friendIds);
      
      // Show results summary
      const successCount = results.filter(r => r.status === 'added').length;
      const alreadyMemberCount = results.filter(r => r.status === 'already_member').length;
      const errorCount = results.filter(r => r.status === 'error').length;
      
      let message = '';
      if (successCount > 0) {
        message += `${successCount} friend${successCount === 1 ? '' : 's'} added to group`;
      }
      if (alreadyMemberCount > 0) {
        message += (message ? ', ' : '') + `${alreadyMemberCount} already member${alreadyMemberCount === 1 ? '' : 's'}`;
      }
      if (errorCount > 0) {
        message += (message ? ', ' : '') + `${errorCount} failed to add`;
      }
      
      if (message) {
        showSuccessMessage(message);
      }
    } catch (error) {
      localError = error.message || 'Failed to add friends';
    } finally {
      isInviting = false;
    }
  }
  
  // Handle phone invitations
  async function handleInviteByPhone(event) {
    const { phoneNumber, name } = event.detail;
    
    isInviting = true;
    localError = '';
    
    try {
      const results = await inviteByPhone(groupId, [{ phoneNumber, name }]);
      
      if (results.length > 0 && results[0].status === 'invited') {
        showSuccessMessage(`Invitation sent to ${name}`);
      } else if (results[0]?.status === 'already_member') {
        localError = 'This person is already a member of the group';
      } else if (results[0]?.status === 'already_invited') {
        localError = 'This person has already been invited';
      } else {
        localError = results[0]?.error || 'Failed to send invitation';
      }
    } catch (error) {
      localError = error.message || 'Failed to send invitation';
    } finally {
      isInviting = false;
    }
  }
  
  // Member management
  async function handlePromoteToAdmin(event) {
    const { memberId } = event.detail;
    
    try {
      await promoteMemberToAdmin(memberId);
      showSuccessMessage('Member promoted to admin');
      await loadGroupMembers(groupId);
    } catch (error) {
      localError = error.message || 'Failed to promote member';
    }
  }
  
  async function handleDemoteFromAdmin(event) {
    const { memberId } = event.detail;
    
    try {
      await demoteAdminToMember(memberId);
      showSuccessMessage('Admin demoted to member');
      await loadGroupMembers(groupId);
    } catch (error) {
      localError = error.message || 'Failed to demote admin';
    }
  }
  
  async function handleRemoveMember(event) {
    const { memberId } = event.detail;
    
    try {
      await removeMember(memberId);
      showSuccessMessage('Member removed from group');
      await loadGroupMembers(groupId);
    } catch (error) {
      localError = error.message || 'Failed to remove member';
    }
  }
  
  // Reset attendance
  async function handleResetAttendance() {
    isResettingAttendance = true;
    localError = '';
    
    try {
      const success = await resetAttendance(groupId);
      
      if (success) {
        showSuccessMessage('All attendance has been reset');
        showResetAttendanceConfirm = false;
      }
    } catch (error) {
      localError = error.message || 'Failed to reset attendance';
    } finally {
      isResettingAttendance = false;
    }
  }
  
  // Delete group
  async function handleDeleteGroup() {
    try {
      const success = await deleteCurrentGroup();
      if (success) {
        goto('/groups');
      }
    } catch (error) {
      localError = error.message || 'Failed to delete group';
      showDeleteConfirm = false;
    }
  }
  
  // Leave group
  async function handleLeaveGroup() {
    try {
      const success = await leaveCurrentGroup();
      if (success) {
        goto('/groups');
      }
    } catch (error) {
      localError = error.message || 'Failed to leave group';
      showLeaveConfirm = false;
    }
  }
  
  function handleError(event) {
    localError = event.detail.message;
  }
  
  function showSuccessMessage(message) {
    successMessage = message;
    setTimeout(() => successMessage = '', 4000);
  }
  
  function clearError() {
    localError = '';
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
      {#if $error || localError}
        <div class="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <div class="flex justify-between items-start">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-red-700">{$error || localError}</p>
              </div>
            </div>
            <button
              on:click={clearError}
              class="text-red-400 hover:text-red-600"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
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
      
      <!-- Add Members -->
      <GroupInvite
        {isInviting}
        on:invite-friends={handleInviteFriends}
        on:invite-by-phone={handleInviteByPhone}
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
      
      <!-- Admin Controls -->
      {#if isAdmin}
        <div class="bg-white shadow rounded-lg p-6 mb-6">
          <h2 class="text-lg font-medium text-gray-900 mb-4">Admin Controls</h2>
          
          <div class="space-y-4">
            <div class="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
              <div>
                <h3 class="text-sm font-medium text-yellow-800">Reset All Attendance</h3>
                <p class="text-sm text-yellow-700 mt-1">
                  Clear attendance status for all group members. This cannot be undone.
                </p>
              </div>
              <button
                on:click={() => showResetAttendanceConfirm = true}
                class="inline-flex items-center px-3 py-2 border border-yellow-300 shadow-sm text-sm leading-4 font-medium rounded-md text-yellow-700 bg-white hover:bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              >
                Reset Attendance
              </button>
            </div>
          </div>
        </div>
      {/if}
      
      <!-- Danger Zone -->
      <div class="bg-white shadow rounded-lg p-6">
        <h2 class="text-lg font-medium text-red-900 mb-4">Danger Zone</h2>
        
        <div class="space-y-4">
          {#if isCreator}
            <div class="flex items-center justify-between p-4 bg-red-50 rounded-lg">
              <div>
                <h3 class="text-sm font-medium text-red-800">Delete Group</h3>
                <p class="text-sm text-red-700 mt-1">
                  Permanently delete this group and all its data. This action cannot be undone.
                </p>
              </div>
              <button
                on:click={() => showDeleteConfirm = true}
                class="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Delete Group
              </button>
            </div>
          {:else}
            <div class="flex items-center justify-between p-4 bg-red-50 rounded-lg">
              <div>
                <h3 class="text-sm font-medium text-red-800">Leave Group</h3>
                <p class="text-sm text-red-700 mt-1">
                  Leave this group. You'll need to be invited again to rejoin.
                </p>
              </div>
              <button
                on:click={() => showLeaveConfirm = true}
                class="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Leave Group
              </button>
            </div>
          {/if}
        </div>
      </div>
    </div>
    
    <!-- Reset Attendance Confirmation Modal -->
    {#if showResetAttendanceConfirm}
      <div class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
          <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
            <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div class="sm:flex sm:items-start">
                <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                  <svg class="h-6 w-6 text-yellow-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                    Reset All Attendance
                  </h3>
                  <div class="mt-2">
                    <p class="text-sm text-gray-500">
                      Are you sure you want to reset attendance for all group members? This will clear everyone's attendance status and cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-yellow-600 text-base font-medium text-white hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                disabled={isResettingAttendance}
                on:click={handleResetAttendance}
              >
                {#if isResettingAttendance}
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Resetting...
                {:else}
                  Reset Attendance
                {/if}
              </button>
              <button
                type="button"
                class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                on:click={() => showResetAttendanceConfirm = false}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}
    
    <!-- Delete Confirmation Modal -->
    {#if showDeleteConfirm}
      <div class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
          <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
            <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div class="sm:flex sm:items-start">
                <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                  <svg class="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                    Delete Group
                  </h3>
                  <div class="mt-2">
                    <p class="text-sm text-gray-500">
                      Are you sure you want to delete "{$currentGroup.name}"? This action cannot be undone and will remove the group for all members.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                on:click={handleDeleteGroup}
              >
                Delete Group
              </button>
              <button
                type="button"
                class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                on:click={() => showDeleteConfirm = false}
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
      <div class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
          <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
            <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">  
              <div class="sm:flex sm:items-start">
                <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                  <svg class="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </div>
                <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                    Leave Group
                  </h3>
                  <div class="mt-2">
                    <p class="text-sm text-gray-500">
                      Are you sure you want to leave "{$currentGroup.name}"? You'll need to be invited again to rejoin.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                on:click={handleLeaveGroup}
              >
                Leave Group
              </button>
              <button
                type="button"
                class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sw:auto sm:text-sm"
                on:click={() => showLeaveConfirm = false}
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