<!-- apps/web/src/lib/components/groups/InviteUser.svelte -->
<script>
    import { onMount, createEventDispatcher } from 'svelte';
    import { goto } from '$app/navigation';
    import { currentGroup, inviteUser, isLoading } from '$lib/stores/groups';
    import { friends, loadFriends } from '$lib/stores/friends';
    import { searchForUsers } from '$lib/stores/friends';
    
    // Props
    export let groupId;
    
    // Local state
    let activeTab = 'friends'; // 'friends', 'email'
    let selectedFriends = [];
    let emailInput = '';
    let messageInput = '';
    let error = null;
    let success = '';
    let searchResults = [];
    let isSearching = false;
    
    const dispatch = createEventDispatcher();
    
    onMount(async () => {
      // Load friends list
      await loadFriends();
    });
    
    // Change active tab
    function setActiveTab(tab) {
      activeTab = tab;
      error = null;
    }
    
    // Toggle selection of a friend
    function toggleFriendSelection(friendId) {
      if (selectedFriends.includes(friendId)) {
        selectedFriends = selectedFriends.filter(id => id !== friendId);
      } else {
        selectedFriends = [...selectedFriends, friendId];
      }
    }
    
    // Search for users by email
    async function searchUsers() {
      if (!emailInput.trim() || emailInput.length < 3) {
        error = 'Please enter a valid email address';
        return;
      }
      
      error = null;
      isSearching = true;
      searchResults = [];
      
      try {
        searchResults = await searchForUsers(emailInput.trim());
        
        if (searchResults.length === 0) {
          error = 'No user found with that email';
        }
      } catch (err) {
        error = err.message;
      } finally {
        isSearching = false;
      }
    }
    
    // Send invite to friends
    async function inviteFriends() {
      if (selectedFriends.length === 0) {
        error = 'Please select at least one friend';
        return;
      }
      
      error = null;
      
      // Find friend emails
      const friendsToInvite = $friends.filter(friend => selectedFriends.includes(friend.id));
      
      // Check for members already in the group
      const alreadyMembers = friendsToInvite.filter(friend => 
        $currentGroup && $currentGroup.members.includes(friend.id)
      );
      
      if (alreadyMembers.length > 0) {
        error = `${alreadyMembers.map(f => f.displayName).join(', ')} ${alreadyMembers.length === 1 ? 'is' : 'are'} already in this group`;
        return;
      }
      
      let inviteCount = 0;
      
      try {
        for (const friend of friendsToInvite) {
          if (friend.email) {
            const invited = await inviteUser(friend.email, messageInput);
            if (invited) inviteCount++;
          }
        }
        
        if (inviteCount > 0) {
          success = `Invited ${inviteCount} ${inviteCount === 1 ? 'friend' : 'friends'} to the group`;
          selectedFriends = [];
          messageInput = '';
        } else {
          error = 'Could not send invites. Some friends may not have email addresses.';
        }
      } catch (err) {
        error = err.message;
      }
    }
    
    // Send invite by email
    async function inviteByEmail() {
      if (!emailInput.trim() || !emailInput.includes('@')) {
        error = 'Please enter a valid email address';
        return;
      }
      
      error = null;
      
      try {
        const invited = await inviteUser(emailInput.trim(), messageInput);
        
        if (invited) {
          success = `Invitation sent to ${emailInput}`;
          emailInput = '';
          messageInput = '';
          searchResults = [];
        }
      } catch (err) {
        error = err.message;
      }
    }
    
    // Return to group
    function returnToGroup() {
      goto(`/groups/${groupId}`);
    }
  </script>
  
  <div class="invite-user">
    <div class="header">
      <button class="back-button" on:click={returnToGroup}>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        <span>Back to Group</span>
      </button>
      
      <h2 class="title">Invite to {$currentGroup ? $currentGroup.name : 'Group'}</h2>
    </div>
    
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
    
    {#if success}
      <div class="alert alert-success">
        <svg xmlns="http://www.w3.org/2000/svg" class="alert-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <span>{success}</span>
      </div>
    {/if}
    
    <div class="tabs">
      <button 
        class="tab-button {activeTab === 'friends' ? 'active' : ''}" 
        on:click={() => setActiveTab('friends')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="tab-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        <span>Invite Friends</span>
      </button>
      
      <button 
        class="tab-button {activeTab === 'email' ? 'active' : ''}" 
        on:click={() => setActiveTab('email')}
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="tab-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
          <polyline points="22,6 12,13 2,6"></polyline>
        </svg>
        <span>Invite by Email</span>
      </button>
    </div>
    
    <div class="tab-content">
      {#if activeTab === 'friends'}
        <div class="friends-tab">
          {#if $friends.length === 0}
            <div class="no-friends">
              <p>You don't have any friends yet. Add some friends or use the email tab to invite people.</p>
            </div>
          {:else}
            <div class="friends-list">
              {#each $friends as friend (friend.id)}
                <!-- Skip already selected friends -->
                {#if !($currentGroup && $currentGroup.members.includes(friend.id))}
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
                {/if}
              {/each}
            </div>
            
            <div class="message-input">
              <label for="friendMessage">Add a message (optional)</label>
              <textarea 
                id="friendMessage" 
                class="input" 
                bind:value={messageInput} 
                placeholder="Write a personal message to include with your invitation"
                rows="3"
              ></textarea>
            </div>
            
            <div class="action-buttons">
              <button class="btn btn-outline" on:click={returnToGroup}>
                Cancel
              </button>
              
              <button 
                class="btn btn-primary" 
                on:click={inviteFriends}
                disabled={$isLoading || selectedFriends.length === 0}
              >
                {#if $isLoading}
                  <span class="loader loader-sm"></span>
                  <span>Sending Invites...</span>
                {:else}
                  <span>Send {selectedFriends.length} {selectedFriends.length === 1 ? 'Invite' : 'Invites'}</span>
                {/if}
              </button>
            </div>
          {/if}
        </div>
      {:else if activeTab === 'email'}
        <div class="email-tab">
          <div class="email-search">
            <div class="input-group">
              <label for="emailInput">Email Address</label>
              <div class="search-input-wrapper">
                <input 
                  type="email" 
                  id="emailInput" 
                  class="input" 
                  bind:value={emailInput} 
                  placeholder="Enter email address"
                  on:keydown={(e) => e.key === 'Enter' && searchUsers()}
                />
                
                <button 
                  class="btn btn-primary" 
                  on:click={searchUsers}
                  disabled={isSearching || !emailInput.trim()}
                >
                  {#if isSearching}
                    <span class="loader loader-sm"></span>
                    <span>Searching...</span>
                  {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <span>Search</span>
                  {/if}
                </button>
              </div>
            </div>
            
            {#if searchResults.length > 0}
              <div class="search-results">
                <h4 class="results-title">User Found</h4>
                {#each searchResults as user (user.id)}
                  <div class="user-result">
                    <div class="user-avatar">
                      {#if user.photoURL}
                        <img src={user.photoURL} alt={user.displayName} />
                      {:else}
                        <div class="avatar-placeholder">
                          {user.displayName ? user.displayName[0].toUpperCase() : '?'}
                        </div>
                      {/if}
                    </div>
                    
                    <div class="user-info">
                      <p class="user-name">{user.displayName || 'User'}</p>
                      <p class="user-email">{user.email}</p>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
          
          <div class="message-input">
            <label for="emailMessage">Add a message (optional)</label>
            <textarea 
              id="emailMessage" 
              class="input" 
              bind:value={messageInput} 
              placeholder="Write a personal message to include with your invitation"
              rows="3"
            ></textarea>
          </div>
          
          <div class="action-buttons">
            <button class="btn btn-outline" on:click={returnToGroup}>
              Cancel
            </button>
            
            <button 
              class="btn btn-primary" 
              on:click={inviteByEmail}
              disabled={$isLoading || !emailInput.trim()}
            >
              {#if $isLoading}
                <span class="loader loader-sm"></span>
                <span>Sending Invite...</span>
              {:else}
                <span>Send Invite</span>
              {/if}
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
  
  <style>
    .invite-user {
      max-width: 800px;
      margin: 0 auto;
    }
    
    .header {
      margin-bottom: var(--space-6);
    }
    
    .back-button {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--primary-600);
      background: none;
      border: none;
      cursor: pointer;
      font-weight: var(--font-medium);
      padding: 0;
      margin-bottom: var(--space-2);
      transition: color var(--transition-fast);
    }
    
    .back-button:hover {
      color: var(--primary-700);
    }
    
    .title {
      font-size: var(--text-2xl);
      color: var(--text-primary);
      margin: 0;
    }
    
    .tabs {
      display: flex;
      gap: var(--space-2);
      margin: var(--space-6) 0;
      border-bottom: 1px solid var(--neutral-200);
    }
    
    .tab-button {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      background: none;
      border: none;
      color: var(--text-secondary);
      font-weight: var(--font-medium);
      cursor: pointer;
      position: relative;
      transition: color var(--transition-fast);
    }
    
    .tab-button:hover {
      color: var(--primary-600);
    }
    
    .tab-button.active {
      color: var(--primary-600);
    }
    
    .tab-button.active::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 0;
      width: 100%;
      height: 2px;
      background-color: var(--primary-600);
    }
    
    .tab-icon {
      flex-shrink: 0;
    }
    
    .no-friends {
      padding: var(--space-6);
      background-color: var(--bg-subtle);
      border-radius: var(--radius-md);
      text-align: center;
      color: var(--text-secondary);
      margin-bottom: var(--space-6);
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
      margin-bottom: var(--space-4);
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
    
    .message-input {
      margin-bottom: var(--space-6);
    }
    
    .message-input label {
      display: block;
      margin-bottom: var(--space-2);
      font-weight: var(--font-medium);
      color: var(--text-primary);
    }
    
    .input-group {
      margin-bottom: var(--space-4);
    }
    
    .input-group label {
      display: block;
      margin-bottom: var(--space-2);
      font-weight: var(--font-medium);
      color: var(--text-primary);
    }
    
    .search-input-wrapper {
      display: flex;
      gap: var(--space-2);
    }
    
    .search-input-wrapper .input {
      flex: 1;
    }
    
    .search-results {
      background-color: var(--bg-subtle);
      border-radius: var(--radius-md);
      padding: var(--space-4);
      margin-top: var(--space-4);
    }
    
    .results-title {
      font-size: var(--text-sm);
      color: var(--text-secondary);
      margin: 0 0 var(--space-3) 0;
    }
    
    .user-result {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      background-color: var(--bg-card);
      padding: var(--space-3);
      border-radius: var(--radius-md);
    }
    
    .user-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      overflow: hidden;
    }
    
    .user-info {
      flex: 1;
    }
    
    .user-name {
      margin: 0 0 var(--space-1) 0;
      font-weight: var(--font-medium);
      color: var(--text-primary);
    }
    
    .user-email {
      margin: 0;
      font-size: var(--text-xs);
      color: var(--text-tertiary);
    }
    
    .action-buttons {
      display: flex;
      justify-content: space-between;
      gap: var(--space-4);
    }
    
    @media (max-width: 768px) {
      .friends-list {
        grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
      }
      
      .search-input-wrapper {
        flex-direction: column;
      }
      
      .action-buttons {
        flex-direction: column;
      }
      
      .action-buttons button {
        width: 100%;
      }
    }
  </style>