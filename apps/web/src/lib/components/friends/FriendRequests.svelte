<!-- apps/web/src/lib/components/friends/FriendRequests.svelte -->
<script>
    import { onMount } from 'svelte';
    import {
      incomingRequests,
      outgoingRequests,
      loadFriendRequests,
      acceptRequest,
      rejectRequest,
      cancelRequest,
      isLoading
    } from '$lib/stores/friends';
  
    // Props
    export let showOutgoing = true;
    export let showIncoming = true;
  
    // Local state
    let error = null;
    let successMessage = '';
    let showSuccess = false;
  
    onMount(() => {
      loadFriendRequests();
    });
  
    // Handle accepting a friend request
    async function handleAcceptRequest(requestId) {
      error = null;
      successMessage = '';
      
      try {
        const success = await acceptRequest(requestId);
        if (success) {
          showSuccessMessage('Friend request accepted');
        }
      } catch (err) {
        error = err.message;
      }
    }
  
    // Handle rejecting a friend request
    async function handleRejectRequest(requestId) {
      error = null;
      successMessage = '';
      
      try {
        const success = await rejectRequest(requestId);
        if (success) {
          showSuccessMessage('Friend request rejected');
        }
      } catch (err) {
        error = err.message;
      }
    }
  
    // Handle canceling a friend request
    async function handleCancelRequest(requestId) {
      error = null;
      successMessage = '';
      
      try {
        const success = await cancelRequest(requestId);
        if (success) {
          showSuccessMessage('Friend request canceled');
        }
      } catch (err) {
        error = err.message;
      }
    }
  
    // Show success message with auto-hide
    function showSuccessMessage(message) {
      successMessage = message;
      showSuccess = true;
      
      // Auto-hide after 3 seconds
      setTimeout(() => {
        showSuccess = false;
        
        // Clear message after animation completes
        setTimeout(() => {
          successMessage = '';
        }, 300);
      }, 3000);
    }
  
    // Format date
    function formatDate(timestamp) {
      if (!timestamp) return '';
      
      const date = timestamp instanceof Date 
        ? timestamp 
        : new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp);
        
      // If today, show time
      const now = new Date();
      if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      
      // If this year, show month and day
      if (date.getFullYear() === now.getFullYear()) {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
      
      // Otherwise show full date
      return date.toLocaleDateString([], { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  </script>
  
  <div class="friend-requests">
    {#if showSuccess && successMessage}
      <div class="success-message" transition:fade={{ duration: 300 }}>
        <svg xmlns="http://www.w3.org/2000/svg" class="success-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <span>{successMessage}</span>
      </div>
    {/if}
    
    {#if error}
      <div class="alert alert-error mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="alert-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span>{error}</span>
      </div>
    {/if}
    
    {#if showIncoming && $incomingRequests.length > 0}
      <div class="section">
        <h3 class="section-title">Incoming Requests</h3>
        <ul class="requests-list">
          {#each $incomingRequests as request (request.id)}
            <li class="request-item">
              <div class="request-info">
                <h4 class="sender-name">{request.senderName}</h4>
                <p class="request-time">{formatDate(request.createdAt)}</p>
                {#if request.message}
                  <p class="request-message">"{request.message}"</p>
                {/if}
              </div>
              
              <div class="request-actions">
                <button 
                  class="btn btn-sm btn-primary" 
                  on:click={() => handleAcceptRequest(request.id)}
                >
                  Accept
                </button>
                <button 
                  class="btn btn-sm btn-outline" 
                  on:click={() => handleRejectRequest(request.id)}
                >
                  Reject
                </button>
              </div>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
    
    {#if showOutgoing && $outgoingRequests.length > 0}
      <div class="section">
        <h3 class="section-title">Sent Requests</h3>
        <ul class="requests-list">
          {#each $outgoingRequests as request (request.id)}
            <li class="request-item">
              <div class="request-info">
                <h4 class="sender-name">
                  To: {request.recipientName}
                  <span class="pending-badge">Pending</span>
                </h4>
                <p class="request-time">{formatDate(request.createdAt)}</p>
                {#if request.message}
                  <p class="request-message">"{request.message}"</p>
                {/if}
              </div>
              
              <div class="request-actions">
                <button 
                  class="btn btn-sm btn-outline" 
                  on:click={() => handleCancelRequest(request.id)}
                >
                  Cancel
                </button>
              </div>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
    
    {#if $isLoading}
      <div class="loading">
        <div class="loader"></div>
        <p>Loading friend requests...</p>
      </div>
    {:else if (showIncoming && showOutgoing && $incomingRequests.length === 0 && $outgoingRequests.length === 0)}
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" class="empty-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="8.5" cy="7" r="4"></circle>
          <line x1="20" y1="8" x2="20" y2="14"></line>
          <line x1="23" y1="11" x2="17" y2="11"></line>
        </svg>
        <p>No pending friend requests</p>
      </div>
    {:else if (showIncoming && !showOutgoing && $incomingRequests.length === 0)}
      <div class="empty-state">
        <p>No incoming friend requests</p>
      </div>
    {:else if (!showIncoming && showOutgoing && $outgoingRequests.length === 0)}
      <div class="empty-state">
        <p>No outgoing friend requests</p>
      </div>
    {/if}
    
    <div class="refresh-button">
      <button 
        class="btn btn-sm btn-outline btn-icon" 
        on:click={loadFriendRequests}
        disabled={$isLoading}
        title="Refresh requests"
      >
        {#if $isLoading}
          <span class="loader loader-sm"></span>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6"></path>
            <path d="M1 20v-6h6"></path>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
        {/if}
      </button>
    </div>
  </div>
  
  <style>
    .friend-requests {
      position: relative;
      margin-bottom: var(--space-6);
    }
    
    .section {
      margin-bottom: var(--space-6);
    }
    
    .section-title {
      font-size: var(--text-lg);
      margin-bottom: var(--space-4);
      color: var(--text-primary);
      font-weight: var(--font-semibold);
      padding-bottom: var(--space-2);
      border-bottom: 1px solid var(--neutral-200);
    }
    
    .requests-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    
    .request-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-4);
      background-color: var(--bg-subtle);
      border-radius: var(--radius-md);
      margin-bottom: var(--space-3);
    }
    
    .request-info {
      flex: 1;
    }
    
    .sender-name {
      margin: 0;
      font-weight: var(--font-medium);
      font-size: var(--text-base);
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    
    .pending-badge {
      display: inline-block;
      background-color: var(--neutral-200);
      color: var(--neutral-600);
      font-size: var(--text-xs);
      padding: 0.125rem 0.5rem;
      border-radius: var(--radius-full);
      font-weight: var(--font-medium);
    }
    
    .request-time {
      margin: var(--space-1) 0 0 0;
      font-size: var(--text-xs);
      color: var(--text-tertiary);
    }
    
    .request-message {
      margin: var(--space-2) 0 0 0;
      font-size: var(--text-sm);
      color: var(--text-secondary);
      font-style: italic;
    }
    
    .request-actions {
      display: flex;
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
      text-align: center;
      padding: var(--space-4) 0;
      color: var(--text-tertiary);
    }
    
    .empty-icon {
      margin-bottom: var(--space-2);
      color: var(--neutral-400);
    }
    
    .success-message {
      position: fixed;
      top: 20px;
      right: 20px;
      background-color: var(--success);
      color: white;
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      gap: var(--space-2);
      z-index: 100;
      box-shadow: var(--shadow-md);
    }
    
    .success-icon {
      flex-shrink: 0;
    }
    
    .refresh-button {
      position: absolute;
      top: -48px;
      right: 0;
    }
    
    .btn-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      padding: 0;
      border-radius: 50%;
    }
    
    @media (max-width: 768px) {
      .request-item {
        flex-direction: column;
        align-items: flex-start;
      }
      
      .request-actions {
        width: 100%;
        margin-top: var(--space-3);
      }
      
      .request-actions button {
        flex: 1;
      }
      
      .success-message {
        left: 20px;
        right: 20px;
      }
    }
  </style>