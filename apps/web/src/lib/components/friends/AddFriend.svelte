<!-- apps/web/src/lib/components/friends/AddFriend.svelte -->
<script>
    import { createEventDispatcher } from 'svelte';
    import { searchForUsers, sendRequest, isLoading } from '$lib/stores/friends';
    
    // Props
    export let modalMode = false;
    
    // Local state
    let searchTerm = '';
    let searchResults = [];
    let searchError = null;
    let isSearching = false;
    let selectedUser = null;
    let requestMessage = '';
    let requestSent = false;
    let sendError = null;
    
    const dispatch = createEventDispatcher();
    
    // Handle search
    async function handleSearch() {
      if (!searchTerm || searchTerm.trim().length < 3) {
        searchError = 'Please enter at least 3 characters';
        return;
      }
      
      searchError = null;
      isSearching = true;
      searchResults = [];
      
      try {
        searchResults = await searchForUsers(searchTerm.trim());
        
        if (searchResults.length === 0) {
          searchError = 'No users found with that email';
        }
      } catch (error) {
        searchError = error.message;
      } finally {
        isSearching = false;
      }
    }
    
    // Select a user from search results
    function selectUser(user) {
      selectedUser = user;
      searchResults = [];
    }
    
    // Cancel selection
    function cancelSelection() {
      selectedUser = null;
      requestMessage = '';
      sendError = null;
    }
    
    // Send friend request
    async function handleSendRequest() {
      if (!selectedUser) return;
      
      sendError = null;
      
      try {
        const success = await sendRequest(selectedUser.id, requestMessage);
        
        if (success) {
          requestSent = true;
          
          // In modal mode, emit event to close modal after short delay
          if (modalMode) {
            setTimeout(() => {
              dispatch('close');
            }, 2000);
          }
        }
      } catch (error) {
        sendError = error.message;
      }
    }
    
    // Reset form for adding another friend
    function handleAddAnother() {
      selectedUser = null;
      requestMessage = '';
      searchTerm = '';
      requestSent = false;
      sendError = null;
      searchResults = [];
    }
  </script>
  
  <div class="add-friend {modalMode ? 'modal-mode' : ''}">
    {#if !requestSent}
      <div class="add-friend-form">
        <h3 class="title">Add a Friend</h3>
        
        {#if !selectedUser}
          <div class="search-section">
            <p class="instructions">Enter the email of the person you want to add</p>
            
            <div class="search-input-wrapper">
              <input 
                type="text" 
                class="input" 
                placeholder="Email address"
                bind:value={searchTerm}
                on:keydown={(e) => e.key === 'Enter' && handleSearch()}
                disabled={isSearching}
              />
              
              <button 
                class="btn btn-primary" 
                on:click={handleSearch}
                disabled={isSearching || !searchTerm.trim()}
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
            
            {#if searchError}
              <div class="search-error">
                <svg xmlns="http://www.w3.org/2000/svg" class="error-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>{searchError}</span>
              </div>
            {/if}
            
            {#if searchResults.length > 0}
              <div class="search-results">
                <h4 class="results-title">Results</h4>
                <ul class="results-list">
                  {#each searchResults as user (user.id)}
                    <li class="result-item" on:click={() => selectUser(user)}>
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
                        <h5 class="user-name">{user.displayName || 'User'}</h5>
                        {#if user.email}
                          <p class="user-email">{user.email}</p>
                        {/if}
                      </div>
                      
                      <button class="btn btn-sm btn-outline">
                        Select
                      </button>
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}
          </div>
        {:else}
          <div class="send-request-section">
            <h4 class="section-subtitle">Send Friend Request</h4>
            
            <div class="selected-user">
              <div class="user-avatar">
                {#if selectedUser.photoURL}
                  <img src={selectedUser.photoURL} alt={selectedUser.displayName} />
                {:else}
                  <div class="avatar-placeholder">
                    {selectedUser.displayName ? selectedUser.displayName[0].toUpperCase() : '?'}
                  </div>
                {/if}
              </div>
              
              <div class="user-info">
                <h5 class="user-name">{selectedUser.displayName || 'User'}</h5>
                {#if selectedUser.email}
                  <p class="user-email">{selectedUser.email}</p>
                {/if}
              </div>
            </div>
            
            <div class="message-input">
              <label for="requestMessage" class="input-label">Add a message (optional)</label>
              <textarea 
                id="requestMessage"
                class="input" 
                placeholder="Hi! I'd like to connect..."
                bind:value={requestMessage}
                rows="3"
              ></textarea>
            </div>
            
            {#if sendError}
              <div class="alert alert-error mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" class="alert-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>{sendError}</span>
              </div>
            {/if}
            
            <div class="action-buttons">
              <button 
                class="btn btn-outline" 
                on:click={cancelSelection}
                disabled={$isLoading}
              >
                Back
              </button>
              
              <button 
                class="btn btn-primary" 
                on:click={handleSendRequest}
                disabled={$isLoading}
              >
                {#if $isLoading}
                  <span class="loader loader-sm"></span>
                  <span>Sending...</span>
                {:else}
                  <span>Send Friend Request</span>
                {/if}
              </button>
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <div class="success-view">
        <svg xmlns="http://www.w3.org/2000/svg" class="success-icon" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        
        <h3 class="success-title">Friend Request Sent!</h3>
        <p class="success-message">
          We've sent a friend request to <strong>{selectedUser.displayName || 'the user'}</strong>.
          You'll be notified when they respond.
        </p>
        
        {#if !modalMode}
          <button class="btn btn-primary mt-4" on:click={handleAddAnother}>
            Add Another Friend
          </button>
        {/if}
      </div>
    {/if}
  </div>
  
  <style>
    .add-friend {
      width: 100%;
      max-width: 500px;
      margin: 0 auto;
    }
    
    .modal-mode {
      padding: 0;
    }
    
    .title {
      font-size: var(--text-xl);
      margin-bottom: var(--space-4);
      color: var(--text-primary);
      text-align: center;
    }
    
    .section-subtitle {
      font-size: var(--text-lg);
      margin-bottom: var(--space-4);
      color: var(--text-primary);
    }
    
    .instructions {
      color: var(--text-secondary);
      margin-bottom: var(--space-4);
      text-align: center;
    }
    
    .search-input-wrapper {
      display: flex;
      gap: var(--space-2);
      margin-bottom: var(--space-4);
    }
    
    .search-input-wrapper .input {
      flex: 1;
    }
    
    .search-error {
      color: var(--error);
      font-size: var(--text-sm);
      display: flex;
      align-items: center;
      gap: var(--space-1);
      margin-bottom: var(--space-4);
    }
    
    .search-results {
      background-color: var(--bg-subtle);
      border-radius: var(--radius-md);
      padding: var(--space-3);
      margin-top: var(--space-4);
    }
    
    .results-title {
      font-size: var(--text-sm);
      margin-bottom: var(--space-2);
      color: var(--text-secondary);
    }
    
    .results-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    
    .result-item {
      display: flex;
      align-items: center;
      padding: var(--space-2);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: background-color var(--transition-fast);
    }
    
    .result-item:hover {
      background-color: var(--bg-card);
    }
    
    .user-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      overflow: hidden;
      margin-right: var(--space-3);
      flex-shrink: 0;
    }
    
    .user-avatar img {
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
    
    .user-info {
      flex: 1;
    }
    
    .user-name {
      margin: 0;
      font-weight: var(--font-medium);
      font-size: var(--text-base);
      color: var(--text-primary);
    }
    
    .user-email {
      margin: var(--space-1) 0 0 0;
      font-size: var(--text-xs);
      color: var(--text-tertiary);
    }
    
    .selected-user {
      display: flex;
      align-items: center;
      background-color: var(--bg-subtle);
      padding: var(--space-3);
      border-radius: var(--radius-md);
      margin-bottom: var(--space-4);
    }
    
    .message-input {
      margin-bottom: var(--space-4);
    }
    
    .input-label {
      display: block;
      margin-bottom: var(--space-2);
      font-size: var(--text-sm);
      color: var(--text-secondary);
    }
    
    .action-buttons {
      display: flex;
      justify-content: space-between;
      gap: var(--space-4);
    }
    
    .success-view {
      text-align: center;
      padding: var(--space-6) var(--space-4);
    }
    
    .success-icon {
      color: var(--success);
      margin-bottom: var(--space-4);
    }
    
    .success-title {
      color: var(--success);
      margin-bottom: var(--space-2);
      font-size: var(--text-xl);
    }
    
    .success-message {
      color: var(--text-secondary);
      margin-bottom: var(--space-4);
    }
    
    @media (max-width: 768px) {
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