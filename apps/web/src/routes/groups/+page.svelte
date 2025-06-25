<!-- Native Mobile Groups Page -->
<script>
  import { onMount, getContext } from 'svelte';
  import { goto } from '$app/navigation';
  import ResponsiveHeader from '$components/core/ResponsiveHeader.svelte';
  import GroupCreationModal from '$components/groups/GroupCreationModal.svelte';
  import LoadingIndicator from '$components/utils/LoadingIndicator.svelte';
  import ContactsPermissionSetup from '$components/auth/ContactsPermissionSetup.svelte';
  import { authStore } from '$stores/auth';
  import { 
    contactsPermission,
    initContactsPermission,
    isContactsPermissionRequired,
    getPermissionStatus
  } from '$lib/services/contactsPermissionService.js';
  
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
  
  const isMobile = getContext("isMobile") || true;
  
  let error = null;
  let showCreateGroupModal = false;
  let isCreating = false;
  let needsContactsPermission = false;
  let hasContactsPermission = false;
  
  onMount(async () => {
    // Redirect to login if not authenticated
    if (!$authStore.user && !$authStore.isLoading) {
      goto('/auth/login?redirect=/groups');
      return;
    }

    if ($authStore.isLoading) {
      const unsubscribe = authStore.subscribe(auth => {
        if (!auth.isLoading) {
          unsubscribe();
          if (!auth.user) {
            goto('/auth/login?redirect=/groups');
            return;
          }
          loadGroupsData();
        }
      });
    } else {
      loadGroupsData();
    }
  });
  
  async function loadGroupsData() {
    try {
      if (await isContactsPermissionRequired()) {
        await initContactsPermission();
        hasContactsPermission = $contactsPermission === 'granted';
        needsContactsPermission = !hasContactsPermission;
      } else {
        hasContactsPermission = true;
        needsContactsPermission = false;
      }
      
      if (hasContactsPermission) {
        await Promise.all([
          loadUserGroups(),
          loadGroupInvites()
        ]);
      }
    } catch (err) {
      console.error('Error loading groups data:', err);
      error = err.message;
    }
  }
  
  $: error = $groupsError || error;
  
  async function openCreateGroupModal() {
    showCreateGroupModal = true;
  }
  
  function closeCreateGroupModal() {
    showCreateGroupModal = false;
    isCreating = false;
  }
  
  async function handleCreateGroup(event) {
    const { groupData, initialMembers } = event.detail;
    
    isCreating = true;
    
    try {
      await createNewGroup(groupData, initialMembers);
      closeCreateGroupModal();
    } catch (err) {
      error = err.message || 'Failed to create group';
      isCreating = false;
    }
  }
  
  async function viewGroup(groupId) {
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

  function handleContactsPermissionGranted() {
    needsContactsPermission = false;
    hasContactsPermission = true;
    loadGroupsData();
  }

  function handleContactsPermissionSkipped() {
    // Since contacts permission is required for groups, redirect to login
    goto('/auth/login?redirect=/groups');
  }
</script>

<svelte:head>
  <title>Groups | Voilà!</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <ResponsiveHeader title="Groups" />
  
  <main class="mobile-section pt-4 pb-24">
    {#if error}
      <div class="mobile-card p-4 mb-4 border-l-4 border-red-500 bg-red-50">
        <div class="flex items-center">
          <svg class="w-5 h-5 text-red-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p class="text-red-700 text-sm font-medium">{error}</p>
        </div>
      </div>
    {/if}

    {#if needsContactsPermission}
      <!-- Contacts Permission Required -->
      <div class="mobile-card p-1">
        <div class="text-center py-8">
          <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
          </div>
          
          <h3 class="text-xl font-bold text-gray-900 mb-4">Contact Access Required</h3>
          <p class="text-gray-600 mb-6">
            Groups require contact access to help you find and add friends. Please grant permission to continue.
          </p>
          
          <ContactsPermissionSetup 
            skipable={false}
            on:permission-granted={handleContactsPermissionGranted}
            on:permission-skipped={handleContactsPermissionSkipped}
            on:show-settings-instructions={() => {
              error = 'Please enable contact access in your device settings to use groups.';
            }}
          />
        </div>
      </div>
    {:else if $isLoading}
      <div class="mobile-card p-8">
        <LoadingIndicator variant="native" text="Loading groups..." />
      </div>
    {:else if hasContactsPermission}
      <!-- Group Invites Section -->
      {#if $groupInvites.length > 0}
        <div class="mb-6">
          <div class="mobile-section-header">
            <h2 class="mobile-section-title">Invitations</h2>
            <span class="mobile-badge mobile-badge-warning">{$groupInvites.length}</span>
          </div>
          
          <div class="mobile-list">
            {#each $groupInvites as invite (invite.id)}
              <div class="mobile-list-item flex-col items-start">
                <div class="flex items-center w-full mb-3">
                  <div class="mobile-avatar mobile-avatar-md bg-purple-100 text-purple-700 font-semibold mr-3 flex items-center justify-center">
                    {invite.groupName ? invite.groupName[0].toUpperCase() : 'G'}
                  </div>
                  <div class="flex-1">
                    <p class="font-semibold text-gray-900">{invite.groupName}</p>
                    <p class="text-sm text-gray-500">Invited by {invite.inviterName}</p>
                    {#if invite.message}
                      <p class="text-sm text-gray-500 italic mt-1">"{invite.message}"</p>
                    {/if}
                  </div>
                </div>
                <div class="flex space-x-2 w-full">
                  <button
                    on:click={() => handleAcceptInvite(invite.id)}
                    class="flex-1 mobile-btn-primary"
                  >
                    Accept
                  </button>
                  <button
                    on:click={() => handleDeclineInvite(invite.id)}
                    class="flex-1 mobile-btn-secondary"
                  >
                    Decline
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}
      
      <!-- My Groups Section -->
      <div>
        <div class="mobile-section-header">
          <h2 class="mobile-section-title">My Groups</h2>
          {#if $groups.length > 0}
            <span class="mobile-badge mobile-badge-primary">{$groups.length}</span>
          {/if}
        </div>
        
        {#if $groups.length === 0}
          <div class="mobile-empty-state">
            <div class="mobile-empty-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
            </div>
            <h3 class="mobile-empty-title">No groups yet</h3>
            <p class="mobile-empty-description">Create a group to find meeting spots together with friends</p>
            <button
              on:click={openCreateGroupModal}
              class="mobile-btn-primary"
            >
              Create Your First Group
            </button>
          </div>
        {:else}
          <div class="mobile-list">
            {#each $groups as group (group.id)}
              <button
                on:click={() => viewGroup(group.id)}
                class="mobile-list-item w-full text-left"
              >
                <!-- Group Avatar -->
                <div class="mobile-avatar mobile-avatar-md bg-blue-100 text-blue-700 font-semibold mr-3 flex items-center justify-center">
                  {group.name ? group.name[0].toUpperCase() : 'G'}
                </div>
                
                <!-- Group Info -->
                <div class="flex-1">
                  <p class="font-semibold text-gray-900">{group.name}</p>
                  {#if group.description}
                    <p class="text-sm text-gray-500 truncate">{group.description}</p>
                  {/if}
                  <div class="flex items-center space-x-3 mt-1">
                    <span class="text-xs text-gray-500 flex items-center">
                      <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/>
                      </svg>
                      {group.members?.length || 0} members
                    </span>
                    {#if group.createdAt}
                      <span class="text-xs text-gray-500 flex items-center">
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        {new Date(group.createdAt).toLocaleDateString()}
                      </span>
                    {/if}
                  </div>
                </div>
                
                <!-- Arrow -->
                <svg class="mobile-list-item-arrow w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <!-- Fallback for unexpected state -->
      <div class="mobile-card p-8">
        <div class="text-center">
          <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">Loading...</h3>
          <p class="text-gray-600">Please wait while we set up your groups.</p>
        </div>
      </div>
    {/if}
  </main>
  
  <!-- Floating Action Button - Only show when user has contacts permission -->
  {#if hasContactsPermission && !needsContactsPermission}
  <button
    on:click={openCreateGroupModal}
    class="mobile-fab"
    aria-label="Create new group"
  >
    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
    </svg>
  </button>
  {/if}
  
  <!-- Create Group Modal -->
  <GroupCreationModal 
    show={showCreateGroupModal}
    {isCreating}
    on:create-group={handleCreateGroup}
    on:cancel={closeCreateGroupModal}
  />
</div>