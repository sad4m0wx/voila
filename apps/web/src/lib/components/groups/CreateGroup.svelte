<!-- apps/web/src/lib/components/groups/CreateGroup.svelte -->
<script>
    import { createEventDispatcher } from 'svelte';
    import { goto } from '$app/navigation';
    import { createNewGroup, isLoading } from '$lib/stores/groups';
    import { friends, loadFriends } from '$lib/stores/friends';
    import { onMount } from 'svelte';
    
    // Props
    export let redirectAfterCreate = true;
    
    // Local state
    let groupName = '';
    let groupDescription = '';
    let selectedFriends = [];
    let error = null;
    let success = false;
    
    const dispatch = createEventDispatcher();
    
    onMount(async () => {
      // Load friends list
      await loadFriends();
    });
    
    // Toggle selection of a friend
    function toggleFriendSelection(friendId) {
      if (selectedFriends.includes(friendId)) {
        selectedFriends = selectedFriends.filter(id => id !== friendId);
      } else {
        selectedFriends = [...selectedFriends, friendId];
      }
    }
    
    // Create the group
    async function handleCreateGroup() {
      if (!groupName.trim()) {
        error = 'Group name is required';
        return;
      }
      
      error = null;
      
      const groupData = {
        name: groupName.trim(),
        description: groupDescription.trim()
      };
      
      try {
        const newGroup = await createNewGroup(groupData, selectedFriends);
        
        if (newGroup) {
          success = true;
          
          // Emit success event
          dispatch('created', { group: newGroup });
          
          // Redirect if requested
          if (redirectAfterCreate) {
            setTimeout(() => {
              goto(`/groups/${newGroup.id}`);
            }, 1500);
          }
        }
      } catch (err) {
        error = err.message;
      }
    }
    
    // Reset form for another group
    function resetForm() {
      groupName = '';
      groupDescription = '';
      selectedFriends = [];
      success = false;
    }
    
    // Cancel creation
    function cancel() {
      dispatch('cancel');
      
      // Navigate back
      goto('/groups');
    }
  </script>
  
  <div class="create-group">
    {#if !success}
      <h2 class="title">Create New Group</h2>
      
      {#if error}
        <div class="alert alert-error">
          <svg xmlns="http://www.w3.org/2000/svg" class="alert-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{error}</span>
        </div>
      {/if}
      
      <div class="form-section">
        <div class="form-group">
          <label for="groupName">Group Name</label>
          <input 
            type="text" 
            id="groupName" 
            class="input" 
            bind:value={groupName} 
            placeholder="Enter group name"
            required
          />
        </div>
        
        <div class="form-group">
          <label for="groupDescription">Description (optional)</label>
          <textarea 
            id="groupDescription" 
            class="input" 
            bind:value={groupDescription} 
            placeholder="What's this group about?"
            rows="3"
          ></textarea>
        </div>
        
        <div class="form-group">
          <label>Add Friends (optional)</label>
          
          {#if $friends.length === 0}
            <div class="no-friends">
              <p>You have no friends to add to this group. You can invite people after creating the group.</p>
            </div>
          {:else}
            <div class="friends-list">
              {#each $friends as friend (friend.id)}
                <div 
                  class="friend-item {selectedFriends.includes(friend.id) ? 'selected' : ''}"
                  on:click={() => toggleFriendSelection(friend.id)}
                >
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
                    <p class="friend-name">{friend.displayName || 'User'}</p>
                    
                    {#if selectedFriends.includes(friend.id)}
                      <div class="selected-indicator">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
        
        <div class="form-actions">
          <button class="btn btn-outline" on:click={cancel}>
            Cancel
          </button>
          
          <button 
            class="btn btn-primary" 
            on:click={handleCreateGroup}
            disabled={$isLoading || !groupName.trim()}
          >
            {#if $isLoading}
              <span class="loader loader-sm"></span>
              <span>Creating...</span>
            {:else}
              <span>Create Group</span>
            {/if}
          </button>
        </div>
      </div>
    {:else}
      <div class="success-view">
        <svg xmlns="http://www.w3.org/2000/svg" class="success-icon" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        
        <h2 class="success-title">Group Created!</h2>
        <p class="success-message">
          Your group has been created successfully.
          {#if redirectAfterCreate}
            Redirecting to group page...
          {/if}
        </p>
        
        {#if !redirectAfterCreate}
          <div class="success-actions">
            <button class="btn btn-primary" on:click={resetForm}>
              Create Another Group
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
  
  <style>
    .create-group {
      max-width: 600px;
      margin: 0 auto;
    }
    
    .title {
      font-size: var(--text-2xl);
      color: var(--text-primary);
      margin-bottom: var(--space-6);
      text-align: center;
    }
    
    .form-section {
      margin-bottom: var(--space-6);
    }
    
    .form-group {
      margin-bottom: var(--space-4);
    }
    
    .form-group label {
      display: block;
      margin-bottom: var(--space-2);
      font-weight: var(--font-medium);
      color: var(--text-primary);
    }
    
    .input {
      width: 100%;
    }
    
    .no-friends {
      background-color: var(--bg-subtle);
      padding: var(--space-4);
      border-radius: var(--radius-md);
    }
    
    .no-friends p {
      margin: 0;
      color: var(--text-secondary);
      font-size: var(--text-sm);
      text-align: center;
    }
    
    .friends-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: var(--space-3);
      max-height: 300px;
      overflow-y: auto;
      padding: var(--space-2);
      border: 1px solid var(--neutral-200);
      border-radius: var(--radius-md);
    }
    
    .friend-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--space-3);
      border-radius: var(--radius-md);
      background-color: var(--bg-subtle);
      cursor: pointer;
      transition: all var(--transition-fast);
      position: relative;
    }
    
    .friend-item:hover {
      background-color: var(--neutral-200);
    }
    
    .friend-item.selected {
      background-color: var(--primary-100);
      border: 1px solid var(--primary-300);
    }
    
    .friend-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      overflow: hidden;
      margin-bottom: var(--space-2);
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
      width: 100%;
      text-align: center;
    }
    
    .friend-name {
      margin: 0;
      font-size: var(--text-sm);
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .selected-indicator {
      position: absolute;
      top: var(--space-2);
      right: var(--space-2);
      background-color: var(--primary-500);
      color: white;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .form-actions {
      display: flex;
      justify-content: space-between;
      gap: var(--space-4);
      margin-top: var(--space-6);
    }
    
    .success-view {
      text-align: center;
      padding: var(--space-6);
    }
    
    .success-icon {
      color: var(--success);
      margin-bottom: var(--space-4);
    }
    
    .success-title {
      color: var(--success);
      margin-bottom: var(--space-2);
    }
    
    .success-message {
      color: var(--text-secondary);
      margin-bottom: var(--space-6);
    }
    
    .success-actions {
      display: flex;
      justify-content: center;
    }
    
    @media (max-width: 768px) {
      .friends-list {
        grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
      }
      
      .form-actions {
        flex-direction: column;
      }
      
      .form-actions button {
        width: 100%;
      }
    }
  </style>