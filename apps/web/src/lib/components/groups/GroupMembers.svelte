<!-- apps/web/src/lib/components/groups/GroupMembers.svelte -->
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
  
  <div class="group-members">
    <div class="section-header">
      <h2 class="section-title">Members ({$currentGroupMembers.length})</h2>
      
      <button 
        class="btn btn-primary btn-sm invite-button"
        on:click={() => goto(`/groups/${groupId}/invite`)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="8.5" cy="7" r="4"></circle>
          <line x1="20" y1="8" x2="20" y2="14"></line>
          <line x1="23" y1="11" x2="17" y2="11"></line>
        </svg>
        <span>Invite People</span>
      </button>
    </div>
    
    {#if $isLoading}
      <div class="loading">
        <div class="loader"></div>
        <p>Loading members...</p>
      </div>
    {:else if $currentGroupMembers.length === 0}
      <div class="empty-state">
        <p>No members found.</p>
      </div>
    {:else}
      <ul class="members-list">
        {#each $currentGroupMembers as member (member.id)}
          <li class="member-item">
            <div class="member-info" on:click={() => viewUserProfile(member.id)}>
              <div class="member-avatar">
                {#if member.photoURL}
                  <img src={member.photoURL} alt={member.displayName} />
                {:else}
                  <div class="avatar-placeholder">
                    {member.displayName ? member.displayName[0].toUpperCase() : '?'}
                  </div>
                {/if}
              </div>
              
              <div class="member-details">
                <div class="member-name-row">
                  <h3 class="member-name">{member.displayName}</h3>
                  
                  {#if member.id === $authStore.user?.uid}
                    <span class="self-badge">You</span>
                  {/if}
                  
                  {#if member.isCreator}
                    <span class="role-badge creator">Owner</span>
                  {:else if member.isAdmin}
                    <span class="role-badge admin">Admin</span>
                  {/if}
                </div>
                
                <div class="member-meta">
                  <span class="join-date">Member since {formatDate(member.joinedAt)}</span>
                  
                  {#if !member.isFriend && member.id !== $authStore.user?.uid}
                    <span class="not-friend-badge">Not Friends</span>
                  {/if}
                </div>
              </div>
            </div>
            
            <div class="member-actions">
              {#if isAdmin || isCreator}
                {#if member.id !== $authStore.user?.uid && member.id !== $currentGroup?.creatorId}
                  <div class="dropdown">
                    <button class="dropdown-button">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="1"></circle>
                        <circle cx="12" cy="5" r="1"></circle>
                        <circle cx="12" cy="19" r="1"></circle>
                      </svg>
                    </button>
                    
                    <div class="dropdown-content">
                      {#if !member.isAdmin && (isCreator || isAdmin)}
                        <button 
                          class="dropdown-item" 
                          on:click={() => showPromoteConfirm(member)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                          </svg>
                          <span>Make Admin</span>
                        </button>
                      {/if}
                      
                      {#if member.isAdmin && isCreator && member.id !== $currentGroup?.creatorId}
                        <button 
                          class="dropdown-item" 
                          on:click={() => showDemoteConfirm(member)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17.3 6.3l-4.8 4.8"></path>
                            <path d="M12.5 3.8L10 6.3l3.9 3.9 2.5-2.5"></path>
                            <path d="M19.2 16.2L14 21.4H3V10.4l5.2-5.2"></path>
                          </svg>
                          <span>Remove Admin</span>
                        </button>
                      {/if}
                      
                      <button 
                        class="dropdown-item text-error" 
                        on:click={() => showRemoveConfirm(member)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
          </li>
        {/each}
      </ul>
    {/if}
    
    {#if error}
      <div class="alert alert-error mt-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="alert-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span>{error}</span>
      </div>
    {/if}
    
    <!-- Confirmation Modals -->
    {#if confirmAction === 'remove' && targetMember}
      <div class="modal-overlay" on:click={closeConfirm}>
        <div class="modal-content" on:click|stopPropagation>
          <h3 class="modal-title">Remove Member?</h3>
          <p class="modal-text">
            Are you sure you want to remove <strong>{targetMember.displayName}</strong> from this group?
            They will need a new invitation to rejoin.
          </p>
          
          <div class="modal-actions">
            <button class="btn btn-outline" on:click={closeConfirm}>
              Cancel
            </button>
            <button 
              class="btn btn-error" 
              on:click={handleRemoveMember}
              disabled={$isLoading}
            >
              {#if $isLoading}
                <span class="loader loader-sm"></span>
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
      <div class="modal-overlay" on:click={closeConfirm}>
        <div class="modal-content" on:click|stopPropagation>
          <h3 class="modal-title">Make Admin?</h3>
          <p class="modal-text">
            Are you sure you want to make <strong>{targetMember.displayName}</strong> an admin of this group?
            Admins can manage members and edit group information.
          </p>
          
          <div class="modal-actions">
            <button class="btn btn-outline" on:click={closeConfirm}>
              Cancel
            </button>
            <button 
              class="btn btn-primary" 
              on:click={handlePromoteMember}
              disabled={$isLoading}
            >
              {#if $isLoading}
                <span class="loader loader-sm"></span>
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
      <div class="modal-overlay" on:click={closeConfirm}>
        <div class="modal-content" on:click|stopPropagation>
          <h3 class="modal-title">Remove Admin Status?</h3>
          <p class="modal-text">
            Are you sure you want to remove admin status from <strong>{targetMember.displayName}</strong>?
            They will become a regular member of the group.
          </p>
          
          <div class="modal-actions">
            <button class="btn btn-outline" on:click={closeConfirm}>
              Cancel
            </button>
            <button 
              class="btn btn-primary" 
              on:click={handleDemoteMember}
              disabled={$isLoading}
            >
              {#if $isLoading}
                <span class="loader loader-sm"></span>
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
  
  <style>
    .group-members {
      margin-top: var(--space-8);
    }
    
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--space-4);
    }
    
    .section-title {
      font-size: var(--text-xl);
      margin: 0;
      color: var(--text-primary);
      font-weight: var(--font-semibold);
    }
    
    .invite-button {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    
    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-8) 0;
      color: var(--text-secondary);
    }
    
    .empty-state {
      padding: var(--space-6);
      text-align: center;
      color: var(--text-tertiary);
      background-color: var(--bg-subtle);
      border-radius: var(--radius-md);
    }
    
    .members-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    
    .member-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-3) var(--space-2);
      border-bottom: 1px solid var(--neutral-100);
    }
    
    .member-info {
      display: flex;
      align-items: center;
      flex: 1;
      cursor: pointer;
      padding: var(--space-2);
      border-radius: var(--radius-md);
      transition: background-color var(--transition-fast);
    }
    
    .member-info:hover {
      background-color: var(--bg-subtle);
    }
    
    .member-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      overflow: hidden;
      margin-right: var(--space-3);
      flex-shrink: 0;
    }
    
    .member-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .avatar-placeholder {
      width: 100%;
      height: 100%;
      background-color: var(--primary-100);
      color: var(--primary-700);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: var(--font-medium);
      font-size: 1.2rem;
    }
    
    .member-details {
      flex: 1;
    }
    
    .member-name-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-1);
    }
    
    .member-name {
      margin: 0;
      font-size: var(--text-base);
      font-weight: var(--font-medium);
      color: var(--text-primary);
    }
    
    .self-badge {
      font-size: var(--text-xs);
      background-color: var(--accent-100);
      color: var(--accent-600);
      padding: 0.125rem 0.375rem;
      border-radius: var(--radius-full);
      font-weight: var(--font-medium);
    }
    
    .role-badge {
      font-size: var(--text-xs);
      padding: 0.125rem 0.375rem;
      border-radius: var(--radius-full);
      font-weight: var(--font-medium);
    }
    
    .role-badge.creator {
      background-color: var(--primary-100);
      color: var(--primary-700);
    }
    
    .role-badge.admin {
      background-color: var(--neutral-100);
      color: var(--neutral-700);
    }
    
    .member-meta {
      font-size: var(--text-xs);
      color: var(--text-tertiary);
      display: flex;
      gap: var(--space-3);
      align-items: center;
    }
    
    .not-friend-badge {
      color: var(--warning);
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }
    
    .not-friend-badge::before {
      content: "•";
      color: var(--warning);
    }
    
    .member-actions {
      flex-shrink: 0;
      position: relative;
    }
    
    .dropdown {
      position: relative;
    }
    
    .dropdown-button {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--neutral-500);
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all var(--transition-fast);
    }
    
    .dropdown-button:hover {
      background-color: var(--neutral-100);
      color: var(--neutral-700);
    }
    
    .dropdown-content {
      position: absolute;
      right: 0;
      z-index: 100;
      background-color: var(--bg-card);
      min-width: 200px;
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      display: none;
      overflow: hidden;
    }
    
    .dropdown:hover .dropdown-content,
    .dropdown:focus-within .dropdown-content {
      display: block;
    }
    
    .dropdown-item {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      width: 100%;
      text-align: left;
      background: none;
      border: none;
      cursor: pointer;
      transition: background-color var(--transition-fast);
      color: var(--text-primary);
    }
    
    .dropdown-item:hover {
      background-color: var(--bg-subtle);
    }
    
    .text-error {
      color: var(--error);
    }
    
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    
    .modal-content {
      background-color: var(--bg-card);
      border-radius: var(--radius-lg);
      padding: var(--space-6);
      max-width: 500px;
      width: 90%;
      box-shadow: var(--shadow-lg);
    }
    
    .modal-title {
      font-size: var(--text-xl);
      color: var(--text-primary);
      margin-bottom: var(--space-4);
    }
    
    .modal-text {
      color: var(--text-secondary);
      margin-bottom: var(--space-6);
    }
    
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-4);
    }
    
    @media (max-width: 768px) {
      .section-header {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-2);
      }
      
      .invite-button {
        width: 100%;
        justify-content: center;
        margin-top: var(--space-2);
      }
      
      .member-item {
        flex-direction: column;
        align-items: flex-start;
      }
      
      .member-info {
        width: 100%;
        margin-bottom: var(--space-2);
      }
      
      .member-actions {
        width: 100%;
        display: flex;
        justify-content: flex-end;
      }
      
      .modal-actions {
        flex-direction: column;
      }
      
      .modal-actions button {
        width: 100%;
      }
    }
  </style>