<!-- apps/web/src/lib/components/groups/GroupInvites.svelte -->
<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { 
      groupInvites, 
      loadGroupInvites, 
      acceptInvite, 
      declineInvite, 
      isLoading 
    } from '$lib/stores/groups';
    
    // Local state
    let error = null;
    let confirmAction = null; // 'accept', 'decline'
    let targetInvite = null;
    
    onMount(() => {
      loadGroupInvites();
    });
    
    // Show confirmation modal
    function showAcceptConfirm(invite) {
      confirmAction = 'accept';
      targetInvite = invite;
    }
    
    function showDeclineConfirm(invite) {
      confirmAction = 'decline';
      targetInvite = invite;
    }
    
    function closeConfirm() {
      confirmAction = null;
      targetInvite = null;
      error = null;
    }
    
    // Accept invite
    async function handleAcceptInvite() {
      if (!targetInvite) return;
      
      try {
        const success = await acceptInvite(targetInvite.id);
        
        if (success) {
          closeConfirm();
          
          // Navigate to the group
          goto(`/groups/${targetInvite.groupId}`);
        }
      } catch (err) {
        error = err.message;
      }
    }
    
    // Decline invite
    async function handleDeclineInvite() {
      if (!targetInvite) return;
      
      try {
        const success = await declineInvite(targetInvite.id);
        
        if (success) {
          closeConfirm();
        }
      } catch (err) {
        error = err.message;
      }
    }
    
    // Format date
    function formatDate(date) {
      if (!date) return '';
      
      const options = { year: 'numeric', month: 'short', day: 'numeric' };
      return new Date(date).toLocaleDateString(undefined, options);
    }
  </script>
  
  <div class="group-invites">
    <h2 class="section-title">Group Invitations</h2>
    
    {#if $isLoading}
      <div class="loading">
        <div class="loader"></div>
        <p>Loading invitations...</p>
      </div>
    {:else if $groupInvites.length === 0}
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" class="empty-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        <p>You don't have any pending group invitations.</p>
      </div>
    {:else}
      <ul class="invites-list">
        {#each $groupInvites as invite (invite.id)}
          <li class="invite-item">
            <div class="invite-info">
              <h3 class="group-name">{invite.groupName}</h3>
              
              <div class="invite-meta">
                <p class="inviter">
                  <svg xmlns="http://www.w3.org/2000/svg" class="meta-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  <span>Invited by {invite.inviterName}</span>
                </p>
                
                <p class="invite-date">
                  <svg xmlns="http://www.w3.org/2000/svg" class="meta-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  <span>Sent {formatDate(invite.createdAt)}</span>
                </p>
              </div>
              
              {#if invite.message}
                <div class="invite-message">
                  <p>"{invite.message}"</p>
                </div>
              {/if}
            </div>
            
            <div class="invite-actions">
              <button 
                class="btn btn-sm btn-primary" 
                on:click={() => showAcceptConfirm(invite)}
              >
                Accept
              </button>
              
              <button 
                class="btn btn-sm btn-outline" 
                on:click={() => showDeclineConfirm(invite)}
              >
                Decline
              </button>
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
    {#if confirmAction === 'accept' && targetInvite}
      <div class="modal-overlay" on:click={closeConfirm}>
        <div class="modal-content" on:click|stopPropagation>
          <h3 class="modal-title">Join Group?</h3>
          <p class="modal-text">
            Are you sure you want to join the group <strong>{targetInvite.groupName}</strong>?
          </p>
          
          <div class="modal-actions">
            <button class="btn btn-outline" on:click={closeConfirm}>
              Cancel
            </button>
            <button 
              class="btn btn-primary" 
              on:click={handleAcceptInvite}
              disabled={$isLoading}
            >
              {#if $isLoading}
                <span class="loader loader-sm"></span>
                <span>Joining...</span>
              {:else}
                <span>Join Group</span>
              {/if}
            </button>
          </div>
        </div>
      </div>
    {/if}
    
    {#if confirmAction === 'decline' && targetInvite}
      <div class="modal-overlay" on:click={closeConfirm}>
        <div class="modal-content" on:click|stopPropagation>
          <h3 class="modal-title">Decline Invitation?</h3>
          <p class="modal-text">
            Are you sure you want to decline the invitation to join <strong>{targetInvite.groupName}</strong>?
          </p>
          
          <div class="modal-actions">
            <button class="btn btn-outline" on:click={closeConfirm}>
              Cancel
            </button>
            <button 
              class="btn btn-primary" 
              on:click={handleDeclineInvite}
              disabled={$isLoading}
            >
              {#if $isLoading}
                <span class="loader loader-sm"></span>
                <span>Declining...</span>
              {:else}
                <span>Decline Invitation</span>
              {/if}
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
  
  <style>
    .group-invites {
      margin-bottom: var(--space-8);
    }
    
    .section-title {
      font-size: var(--text-xl);
      color: var(--text-primary);
      margin-bottom: var(--space-4);
      font-weight: var(--font-semibold);
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
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: var(--space-6);
      background-color: var(--bg-subtle);
      border-radius: var(--radius-md);
      color: var(--text-tertiary);
    }
    
    .empty-icon {
      margin-bottom: var(--space-3);
      color: var(--neutral-400);
    }
    
    .invites-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    
    .invite-item {
      display: flex;
      flex-direction: column;
      background-color: var(--bg-subtle);
      border-radius: var(--radius-md);
      padding: var(--space-4);
      margin-bottom: var(--space-3);
    }
    
    .invite-info {
      margin-bottom: var(--space-3);
    }
    
    .group-name {
      font-size: var(--text-lg);
      margin: 0 0 var(--space-2) 0;
      color: var(--text-primary);
    }
    
    .invite-meta {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-4);
      margin-bottom: var(--space-2);
    }
    
    .meta-icon {
      color: var(--neutral-500);
      margin-right: var(--space-1);
      vertical-align: middle;
    }
    
    .inviter, .invite-date {
      font-size: var(--text-sm);
      color: var(--text-secondary);
      margin: 0;
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }
    
    .invite-message {
      background-color: var(--bg-card);
      border-radius: var(--radius-md);
      padding: var(--space-3);
      margin-top: var(--space-3);
    }
    
    .invite-message p {
      margin: 0;
      color: var(--text-secondary);
      font-style: italic;
      font-size: var(--text-sm);
    }
    
    .invite-actions {
      display: flex;
      gap: var(--space-3);
      margin-top: var(--space-2);
      align-self: flex-end;
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
      .invite-item {
        flex-direction: column;
      }
      
      .invite-meta {
        flex-direction: column;
        gap: var(--space-2);
      }
      
      .invite-actions {
        align-self: stretch;
        margin-top: var(--space-3);
      }
      
      .invite-actions button {
        flex: 1;
      }
      
      .modal-actions {
        flex-direction: column;
      }
      
      .modal-actions button {
        width: 100%;
      }
    }
  </style>