<!-- src/lib/components/groups/GroupMembers.svelte -->
<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { 
    currentGroup, 
    currentGroupMembers, 
    loadGroupMembers, 
    removeMember, 
    promoteMemberToAdmin, 
    demoteAdminToMember, 
    isLoading 
  } from '$lib/stores/groups';
  import { authStore } from '$lib/stores/auth';
  
  // Props
  export let groupId;
  
  // Local state
  let error = null;
  let confirmAction = null; // 'remove', 'promote', 'demote'
  let targetMember = null;
  
  // On mount, load members
  onMount(() => {
    loadGroupMembers(groupId);
  });
  
  // Determine if current user is admin
  $: isAdmin = $currentGroup && $authStore.user ? 
    $currentGroup.admins.includes($authStore.user.uid) : false;
  
  // Determine if current user is creator
  $: isCreator = $currentGroup && $authStore.user ? 
    $currentGroup.creatorId === $authStore.user.uid : false;
  
  // Member actions
  function showRemoveConfirm(member) {
    confirmAction = 'remove';
    targetMember = member;
  }
  
  function showPromoteConfirm(member) {
    confirmAction = 'promote';
    targetMember = member;
  }
  
  function showDemoteConfirm(member) {
    confirmAction = 'demote';
    targetMember = member;
  }
  
  function closeConfirm() {
    confirmAction = null;
    targetMember = null;
    error = null;
  }
  
  // Execute actions
  async function handleRemoveMember() {
    if (!targetMember) return;
    
    try {
      const success = await removeMember(targetMember.id);
      
      if (success) {
        closeConfirm();
      }
    } catch (err) {
      error = err.message;
    }
  }
  
  async function handlePromoteMember() {
    if (!targetMember) return;
    
    try {
      const success = await promoteMemberToAdmin(targetMember.id);
      
      if (success) {
        closeConfirm();
      }
    } catch (err) {
      error = err.message;
    }
  }
  
  async function handleDemoteMember() {
    if (!targetMember) return;
    
    try {
      const success = await demoteAdminToMember(targetMember.id);
      
      if (success) {
        closeConfirm();
      }
    } catch (err) {
      error = err.message;
    }
  }
  
  // View user profile
  function viewUserProfile(userId) {
    goto(`/user/${userId}`);
  }
  
  // Format date
  function formatDate(date) {
    if (!date) return '';
    
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(date).toLocaleDateString(undefined, options);
  }
</script>

<div class="mt-8">
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
    <h2 class="text-xl font-semibold text-gray-900">Members ({$currentGroupMembers.length})</h2>
    
    <a
      href="/groups/{groupId}/invite"
      class="flex items-center gap-2 mt-2 sm:mt-0 px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="8.5" cy="7" r="4"></circle>
        <line x1="20" y1="8" x2="20" y2="14"></line>
        <line x1="23" y1="11" x2="17" y2="11"></line>
      </svg>
      <span>Invite People</span>
    </a>
  </div>
  
  {#if $isLoading}
    <div class="flex flex-col items-center justify-center py-8 text-gray-500">
      <div class="w-10 h-10 border-4 border-gray-200 border-t-primary-600 rounded-full animate-spin mb-4"></div>
      <p>Loading members...</p>
    </div>
  {:else if $currentGroupMembers.length === 0}
    <div class="flex flex-col items-center justify-center py-8 text-center text-gray-500 bg-gray-50 rounded-lg">
      <p>No members found.</p>
    </div>
  {:else}
    <ul class="divide-y divide-gray-100">
      {#each $currentGroupMembers as member (member.id)}
        <li class="py-3">
          <div class="flex justify-between items-center">
            <div 
              class="flex items-center flex-1 cursor-pointer px-2 py-2 rounded-md hover:bg-gray-50"
              on:click={() => viewUserProfile(member.id)}
            >
              <div class="flex-shrink-0 mr-3">
                {#if member.photoURL}
                  <img src={member.photoURL} alt={member.displayName} class="h-10 w-10 rounded-full" />
                {:else}
                  <div class="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium">
                    {member.displayName ? member.displayName[0].toUpperCase() : '?'}
                  </div>
                {/if}
              </div>
              
              <div>
                <div class="flex items-center">
                  <h3 class="text-sm font-medium text-gray-900">{member.displayName}</h3>
                  
                  {#if member.id === $authStore.user?.uid}
                    <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      You
                    </span>
                  {/if}
                  
                  {#if member.isCreator}
                    <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                      Owner
                    </span>
                  {:else if member.isAdmin}
                    <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Admin
                    </span>
                  {/if}
                </div>
                
                <div class="mt-1 text-xs text-gray-500">
                  <span>Member since {formatDate(member.joinedAt)}</span>
                  
                  {#if !member.isFriend && member.id !== $authStore.user?.uid}
                    <span class="ml-2 text-yellow-600">• Not Friends</span>
                  {/if}
                </div>
              </div>
            </div>
            
            <div class="pl-2">
              {#if isAdmin || isCreator}
                {#if member.id !== $authStore.user?.uid && member.id !== $currentGroup?.creatorId}
                  <div class="relative group">
                    <button 
                      class="p-2 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      aria-label="Member options"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="1"></circle>
                        <circle cx="12" cy="5" r="1"></circle>
                        <circle cx="12" cy="19" r="1"></circle>
                      </svg>
                    </button>
                    
                    <div class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 hidden group-hover:block focus-within:block">
                      {#if !member.isAdmin && (isCreator || isAdmin)}
                        <button 
                          class="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          on:click={() => showPromoteConfirm(member)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                          </svg>
                          <span>Make Admin</span>
                        </button>
                      {/if}
                      
                      {#if member.isAdmin && isCreator && member.id !== $currentGroup?.creatorId}
                        <button 
                          class="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          on:click={() => showDemoteConfirm(member)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17.3 6.3l-4.8 4.8"></path>
                            <path d="M12.5 3.8L10 6.3l3.9 3.9 2.5-2.5"></path>
                            <path d="M19.2 16.2L14 21.4H3V10.4l5.2-5.2"></path>
                          </svg>
                          <span>Remove Admin</span>
                        </button>
                      {/if}
                      
                      <button 
                        class="w-full flex items-center px-4 py-2 text-sm text-red-700 hover:bg-gray-100"
                        on:click={() => showRemoveConfirm(member)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                          <circle cx="8.5" cy="7" r="4"></circle>
                          <line x1="18" y1="8" x2="23" y2="13"></line>
                          <line x1="23" y1="8" x2="18" y2="13"></line>
                        </svg>
                        <span>Remove from Group</span>
                      </button>
                    </div>
                  </div>
                {/if}
              {/if}
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
  
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
  
  <!-- Confirmation Modals -->
  {#if confirmAction === 'remove' && targetMember}
    <div class="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center" on:click={closeConfirm}>
      <div class="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4 w-full" on:click|stopPropagation>
        <h3 class="text-xl font-medium text-gray-900 mb-4">Remove Member?</h3>
        <p class="text-gray-600 mb-6">
          Are you sure you want to remove <strong>{targetMember.displayName}</strong> from this group?
          They will need a new invitation to rejoin.
        </p>
        
        <div class="flex justify-end gap-4">
          <button 
            class="px-4 py-2 font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            on:click={closeConfirm}
          >
            Cancel
          </button>
          <button 
            class="px-4 py-2 font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            on:click={handleRemoveMember}
            disabled={$isLoading}
          >
            {#if $isLoading}
              <div class="inline-block w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Removing...</span>
            {:else}
              <span>Remove Member</span>
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}
  
  {#if confirmAction === 'promote' && targetMember}
    <div class="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center" on:click={closeConfirm}>
      <div class="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4 w-full" on:click|stopPropagation>
        <h3 class="text-xl font-medium text-gray-900 mb-4">Make Admin?</h3>
        <p class="text-gray-600 mb-6">
          Are you sure you want to make <strong>{targetMember.displayName}</strong> an admin of this group?
          Admins can manage members and edit group information.
        </p>
        
        <div class="flex justify-end gap-4">
          <button 
            class="px-4 py-2 font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            on:click={closeConfirm}
          >
            Cancel
          </button>
          <button 
            class="px-4 py-2 font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            on:click={handlePromoteMember}
            disabled={$isLoading}
          >
            {#if $isLoading}
              <div class="inline-block w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Promoting...</span>
            {:else}
              <span>Make Admin</span>
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}
  
  {#if confirmAction === 'demote' && targetMember}
    <div class="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center" on:click={closeConfirm}>
      <div class="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4 w-full" on:click|stopPropagation>
        <h3 class="text-xl font-medium text-gray-900 mb-4">Remove Admin Status?</h3>
        <p class="text-gray-600 mb-6">
          Are you sure you want to remove admin status from <strong>{targetMember.displayName}</strong>?
          They will become a regular member of the group.
        </p>
        
        <div class="flex justify-end gap-4">
          <button 
            class="px-4 py-2 font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            on:click={closeConfirm}
          >
            Cancel
          </button>
          <button 
            class="px-4 py-2 font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            on:click={handleDemoteMember}
            disabled={$isLoading}
          >
            {#if $isLoading}
              <div class="inline-block w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Updating...</span>
            {:else}
              <span>Remove Admin Status</span>
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>