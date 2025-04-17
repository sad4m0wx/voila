<!-- apps/web/src/routes/friends/+page.svelte -->
<script>
    import { onMount } from 'svelte';
    import AuthProvider from '$lib/components/auth/AuthProvider.svelte';
    import { isAuthenticated, isLoading as authLoading } from '$lib/stores/auth';
    import FriendsList from '$lib/components/friends/FriendsList.svelte';
    import FriendRequests from '$lib/components/friends/FriendRequests.svelte';
    import UserSearch from '$lib/components/friends/UserSearch.svelte';
    
    // State
    let activeTab = 'friends'; // 'friends', 'requests', 'search'
    
    onMount(() => {
      // Redirect if not authenticated after loading completes
      const unsubscribe = isAuthenticated.subscribe(value => {
        if (!$authLoading && !value) {
          window.location.href = '/auth/login?redirect=/friends';
        }
      });
      
      // Get tab from URL hash if present
      const hash = window.location.hash.substring(1);
      if (hash === 'requests' || hash === 'search') {
        activeTab = hash;
      }
      
      return unsubscribe;
    });
    
    // Change tab and update URL hash
    function changeTab(tab) {
      activeTab = tab;
      window.location.hash = tab;
    }
  </script>
  
  <svelte:head>
    <title>Friends | Voilà!</title>
    <meta name="description" content="Manage your friends on Voilà" />
  </svelte:head>
  
  <AuthProvider>
    <div class="friends-page">
      <div class="page-header">
        <h1>Friends</h1>
      </div>
      
      <div class="tabs">
        <button 
          class="tab-button {activeTab === 'friends' ? 'active' : ''}" 
          on:click={() => changeTab('friends')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="tab-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <span>My Friends</span>
        </button>
        
        <button 
          class="tab-button {activeTab === 'requests' ? 'active' : ''}" 
          on:click={() => changeTab('requests')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="tab-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="8.5" cy="7" r="4"></circle>
            <path d="M20 8l4 4"></path>
            <path d="M23 11h-6"></path>
          </svg>
          <span>Friend Requests</span>
        </button>
        
        <button 
          class="tab-button {activeTab === 'search' ? 'active' : ''}" 
          on:click={() => changeTab('search')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="tab-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <span>Find Friends</span>
        </button>
      </div>
      
      <div class="tab-content">
        {#if activeTab === 'friends'}
          <FriendsList />
        {:else if activeTab === 'requests'}
          <FriendRequests />
        {:else if activeTab === 'search'}
          <UserSearch />
        {/if}
      </div>
    </div>
  </AuthProvider>
  
  <style>
    .friends-page {
      max-width: 800px;
      margin: 0 auto;
      padding: var(--space-4);
    }
    
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--space-6);
    }
    
    h1 {
      font-size: var(--text-3xl);
      color: var(--text-primary);
      margin: 0;
    }
    
    .tabs {
      display: flex;
      gap: var(--space-2);
      margin-bottom: var(--space-6);
      border-bottom: 2px solid var(--neutral-200);
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
      font-size: var(--text-base);
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
      bottom: -2px;
      left: 0;
      width: 100%;
      height: 2px;
      background-color: var(--primary-600);
    }
    
    .tab-icon {
      flex-shrink: 0;
    }
    
    .tab-content {
      background-color: var(--bg-card);
      border-radius: var(--radius-lg);
      padding: var(--space-6);
      box-shadow: var(--shadow-md);
    }
    
    @media (max-width: 768px) {
      .page-header {
        margin-bottom: var(--space-4);
      }
      
      h1 {
        font-size: var(--text-2xl);
      }
      
      .tabs {
        margin-bottom: var(--space-4);
      }
      
      .tab-button {
        flex: 1;
        padding: var(--space-2);
        font-size: var(--text-sm);
        justify-content: center;
      }
      
      .tab-button span {
        display: none;
      }
      
      .tab-icon {
        margin-right: 0;
      }
      
      .tab-content {
        padding: var(--space-4);
      }
    }
  </style>