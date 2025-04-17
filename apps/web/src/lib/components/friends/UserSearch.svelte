<!-- apps/web/src/lib/components/friends/UserSearch.svelte -->
<script>
    import { createEventDispatcher } from 'svelte';
    import { goto } from '$app/navigation';
    import { searchForUsers } from '$lib/stores/friends';
    
    // Local state
    let searchTerm = '';
    let searchResults = [];
    let searchError = null;
    let isSearching = false;
    
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
    
    // Navigate to user profile
    function viewProfile(userId) {
      goto(`/user/${userId}`);
    }
  </script>
  
  <div class="user-search">
    <h3 class="title">Find Friends</h3>
    
    <div class="search-section">
      <p class="instructions">Enter the email of the person you want to find</p>
      
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
              <li class="result-item">
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
                
                <button 
                  class="btn btn-sm btn-outline view-profile" 
                  on:click={() => viewProfile(user.id)}
                >
                  View Profile
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  </div>
  
  <style>
    .user-search {
      width: 100%;
    }
    
    .title {
      font-size: var(--text-xl);
      margin-bottom: var(--space-4);
      color: var(--text-primary);
      font-weight: var(--font-semibold);
    }
    
    .instructions {
      color: var(--text-secondary);
      margin-bottom: var(--space-4);
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
      padding: var(--space-4);
      margin-top: var(--space-4);
    }
    
    .results-title {
      font-size: var(--text-sm);
      margin-bottom: var(--space-2);
      color: var(--text-secondary);
      border-bottom: 1px solid var(--neutral-200);
      padding-bottom: var(--space-2);
    }
    
    .results-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    
    .result-item {
      display: flex;
      align-items: center;
      padding: var(--space-3);
      border-radius: var(--radius-md);
      margin-bottom: var(--space-2);
      background-color: var(--bg-card);
      transition: transform var(--transition-fast);
    }
    
    .result-item:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-sm);
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
    
    .view-profile {
      flex-shrink: 0;
    }
    
    @media (max-width: 768px) {
      .search-input-wrapper {
        flex-direction: column;
      }
      
      .result-item {
        flex-direction: column;
        align-items: flex-start;
        text-align: center;
      }
      
      .user-avatar {
        margin: 0 auto var(--space-2);
      }
      
      .user-info {
        width: 100%;
        text-align: center;
        margin-bottom: var(--space-2);
      }
      
      .view-profile {
        width: 100%;
      }
    }
  </style>