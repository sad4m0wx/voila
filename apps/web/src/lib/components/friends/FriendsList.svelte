<!-- apps/web/src/lib/components/friends/FriendsList.svelte -->
<script>
    import { onMount } from 'svelte';
    import { friends, loadFriends, removeUserFriend, isLoading } from '$lib/stores/friends';
  
    // Props
    export let showRemoveButton = true;
    export let showEmptyState = true;
    export let title = "Friends";
  
    // Local state
    let confirmRemoveId = null;
    let deleteError = null;
  
    onMount(() => {
      loadFriends();
    });
  
    // Handle friend removal
    async function handleRemoveFriend(friendId) {
      deleteError = null;
      
      try {
        const success = await removeUserFriend(friendId);
        if (success) {
          confirmRemoveId = null;
        }
      } catch (error) {
        deleteError = error.message;
      }
    }
  
    // Show confirmation dialog
    function confirmRemove(friendId) {
      confirmRemoveId = friendId;
    }
  
    // Cancel removal
    function cancelRemove() {
      confirmRemoveId = null;
    }
  </script>
  
  <div class="friends-list">
    <h3 class="title">{title}</h3>
    
    {#if $isLoading}
      <div class="loading">
        <div class="loader"></div>
        <p>Loading friends...</p>
      </div>
    {:else if $friends.length === 0 && showEmptyState}
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" class="empty-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        <p>You don't have any friends yet.</p>
        <a href="/friends/add" class="btn btn-sm btn-primary">Add Friends</a>
      </div>
    {:else}
      <ul class="friends">
        {#each $friends as friend (friend.id)}
          <li class="friend-item">
            <div class="friend-avatar">
              {#if friend.photoURL}
                <img src={friend.photoURL} alt={friend.displayName} />
              {:else}
                <div class="avatar-placeholder">
                  {friend.displayName ? friend.displayName[0].toUpperCase() : '?'}
                </div>
              {/if}
            </div>
            
            <div class="friend-info">
              <h4 class="friend-name">{friend.displayName || 'User'}</h4>
              {#if friend.email}
                <p class="friend-email">{friend.email}</p>
              {/if}
            </div>
            
            {#if showRemoveButton}
              <div class="friend-actions">
                {#if confirmRemoveId === friend.id}
                  <div class="confirm-remove">
                    <p>Remove friend?</p>
                    <div class="confirm-buttons">
                      <button 
                        class="btn btn-sm btn-error" 
                        on:click={() => handleRemoveFriend(friend.id)}
                      >
                        Yes
                      </button>
                      <button 
                        class="btn btn-sm btn-outline" 
                        on:click={cancelRemove}
                      >
                        No
                      </button>
                    </div>
                  </div>
                {:else}
                  <button 
                    class="btn btn-sm btn-outline btn-icon" 
                    on:click={() => confirmRemove(friend.id)}
                    title="Remove friend"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="8.5" cy="7" r="4"></circle>
                      <line x1="18" y1="8" x2="23" y2="13"></line>
                      <line x1="23" y1="8" x2="18" y2="13"></line>
                    </svg>
                  </button>
                {/if}
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
    
    {#if deleteError}
      <div class="alert alert-error mt-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="alert-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span>{deleteError}</span>
      </div>
    {/if}
  </div>
  
  <style>
    .friends-list {
      margin-bottom: var(--space-6);
    }
    
    .title {
      font-size: var(--text-xl);
      margin-bottom: var(--space-4);
      color: var(--text-primary);
      font-weight: var(--font-semibold);
      padding-bottom: var(--space-2);
      border-bottom: 1px solid var(--neutral-200);
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
      padding: var(--space-8) 0;
      color: var(--text-tertiary);
    }
    
    .empty-icon {
      margin-bottom: var(--space-4);
      color: var(--neutral-400);
    }
    
    .friends {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    
    .friend-item {
      display: flex;
      align-items: center;
      padding: var(--space-3) 0;
      border-bottom: 1px solid var(--neutral-100);
    }
    
    .friend-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      overflow: hidden;
      margin-right: var(--space-3);
      flex-shrink: 0;
    }
    
    .friend-avatar img {
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
    
    .friend-info {
      flex: 1;
    }
    
    .friend-name {
      margin: 0;
      font-weight: var(--font-medium);
      font-size: var(--text-base);
      color: var(--text-primary);
    }
    
    .friend-email {
      margin: var(--space-1) 0 0 0;
      font-size: var(--text-xs);
      color: var(--text-tertiary);
    }
    
    .friend-actions {
      margin-left: var(--space-2);
    }
    
    .confirm-remove {
      background-color: var(--neutral-100);
      padding: var(--space-2);
      border-radius: var(--radius-md);
      font-size: var(--text-xs);
    }
    
    .confirm-remove p {
      margin: 0 0 var(--space-2) 0;
      font-weight: var(--font-medium);
    }
    
    .confirm-buttons {
      display: flex;
      gap: var(--space-2);
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
    
    .btn-error {
      background-color: var(--error);
      color: white;
    }
    
    .btn-error:hover {
      background-color: #d32f2f;
    }
    
    @media (max-width: 768px) {
      .friend-item {
        padding: var(--space-2) 0;
      }
      
      .friend-avatar {
        width: 32px;
        height: 32px;
      }
      
      .confirm-remove {
        position: absolute;
        right: var(--space-4);
        background-color: white;
        box-shadow: var(--shadow-md);
        z-index: 10;
      }
    }
  </style>