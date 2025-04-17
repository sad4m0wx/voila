<!-- apps/web/src/routes/user/[id]/+page.svelte -->
<script>
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import AuthProvider from '$lib/components/auth/AuthProvider.svelte';
    import { authStore, isAuthenticated, isLoading as authLoading } from '$lib/stores/auth';
    import { 
      sendRequest, 
      incomingRequests, 
      outgoingRequests, 
      friends, 
      acceptRequest, 
      cancelRequest,
      loadFriends,
      loadFriendRequests
    } from '$lib/stores/friends';
    import { doc, getDoc, getFirestore } from 'firebase/firestore';
  
    // State
    let loading = true;
    let userProfile = null;
    let error = null;
    let friendStatus = 'none'; // 'none', 'self', 'friends', 'pending_outgoing', 'pending_incoming'
    let pendingRequestId = null;
    let requestMessage = '';
    let showRequestForm = false;
    let processingRequest = false;
    let successMessage = '';
  
    // Get user ID from URL parameter
    const userId = $page.params.id;
  
    onMount(async () => {
      // Redirect if not authenticated after loading completes
      const unsubscribe = isAuthenticated.subscribe(value => {
        if (!$authLoading && !value) {
          goto('/login?redirect=' + window.location.pathname);
        }
      });
  
      // Load user profile when authenticated
      if ($authStore.user) {
        await loadUserProfile();
        await loadFriendshipStatus();
      }
  
      return unsubscribe;
    });
  
    // Watch auth state to load profile when user logs in
    $: if ($authStore.user && loading && !userProfile) {
      loadUserProfile();
      loadFriendshipStatus();
    }
  
    // Load user profile data
    async function loadUserProfile() {
      loading = true;
      error = null;
  
      try {
        const db = getFirestore();
        const userDoc = await getDoc(doc(db, 'users', userId));
  
        if (!userDoc.exists()) {
          error = 'User not found';
          loading = false;
          return;
        }
  
        // Get user data excluding sensitive information
        const userData = userDoc.data();
        userProfile = {
          id: userId,
          displayName: userData.displayName || 'User',
          photoURL: userData.photoURL || null,
          email: userData.email || null,
          bio: userData.bio || null,
          // We intentionally don't include saved addresses, home address, etc.
        };
  
      } catch (err) {
        console.error('Error loading user profile:', err);
        error = 'Failed to load user profile';
      } finally {
        loading = false;
      }
    }
  
    // Determine friendship status
    async function loadFriendshipStatus() {
      if (!$authStore.user || !userId) return;
  
      // Load friendship data if not already loaded
      await Promise.all([
        loadFriends(),
        loadFriendRequests()
      ]);
  
      // Check if viewing own profile
      if (userId === $authStore.user.uid) {
        friendStatus = 'self';
        return;
      }
  
      // Check if already friends
      const isFriend = $friends.some(friend => friend.id === userId);
      if (isFriend) {
        friendStatus = 'friends';
        return;
      }
  
      // Check for outgoing friend requests
      const outgoingRequest = $outgoingRequests.find(req => req.recipientId === userId);
      if (outgoingRequest) {
        friendStatus = 'pending_outgoing';
        pendingRequestId = outgoingRequest.id;
        return;
      }
  
      // Check for incoming friend requests
      const incomingRequest = $incomingRequests.find(req => req.senderId === userId);
      if (incomingRequest) {
        friendStatus = 'pending_incoming';
        pendingRequestId = incomingRequest.id;
        return;
      }
  
      // Not friends or pending
      friendStatus = 'none';
    }
  
    // Send friend request
    async function handleSendRequest() {
      processingRequest = true;
      error = null;
      
      try {
        const success = await sendRequest(userId, requestMessage);
        
        if (success) {
          friendStatus = 'pending_outgoing';
          showRequestForm = false;
          successMessage = 'Friend request sent!';
          
          // Auto-hide success message after 3 seconds
          setTimeout(() => {
            successMessage = '';
          }, 3000);
        }
      } catch (err) {
        error = err.message;
      } finally {
        processingRequest = false;
      }
    }
  
    // Accept incoming friend request
    async function handleAcceptRequest() {
      if (!pendingRequestId) return;
      
      processingRequest = true;
      error = null;
      
      try {
        const success = await acceptRequest(pendingRequestId);
        
        if (success) {
          friendStatus = 'friends';
          successMessage = 'Friend request accepted!';
          
          // Auto-hide success message after 3 seconds
          setTimeout(() => {
            successMessage = '';
          }, 3000);
        }
      } catch (err) {
        error = err.message;
      } finally {
        processingRequest = false;
      }
    }
  
    // Cancel outgoing friend request
    async function handleCancelRequest() {
      if (!pendingRequestId) return;
      
      processingRequest = true;
      error = null;
      
      try {
        const success = await cancelRequest(pendingRequestId);
        
        if (success) {
          friendStatus = 'none';
          pendingRequestId = null;
          successMessage = 'Friend request canceled';
          
          // Auto-hide success message after 3 seconds
          setTimeout(() => {
            successMessage = '';
          }, 3000);
        }
      } catch (err) {
        error = err.message;
      } finally {
        processingRequest = false;
      }
    }
  </script>
  
  <svelte:head>
    <title>{userProfile ? userProfile.displayName : 'User'} | Voilà!</title>
    <meta name="description" content="View user profile on Voilà" />
  </svelte:head>
  
  <AuthProvider>
    <div class="user-profile-page">
      {#if loading}
        <div class="loading-state">
          <div class="loader"></div>
          <p>Loading profile...</p>
        </div>
      {:else if error}
        <div class="error-state">
          <svg xmlns="http://www.w3.org/2000/svg" class="error-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h2>Error</h2>
          <p>{error}</p>
          <a href="/friends" class="btn btn-primary">Go to Friends</a>
        </div>
      {:else if userProfile}
        <div class="profile-header">
          <a href="/friends" class="back-link">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Back to Friends</span>
          </a>
        </div>
        
        <div class="profile-card">
          <div class="profile-top">
            <div class="profile-avatar">
              {#if userProfile.photoURL}
                <img src={userProfile.photoURL} alt={userProfile.displayName} />
              {:else}
                <div class="avatar-placeholder">
                  {userProfile.displayName ? userProfile.displayName[0].toUpperCase() : '?'}
                </div>
              {/if}
            </div>
            
            <div class="profile-info">
              <h1 class="profile-name">{userProfile.displayName}</h1>
              {#if userProfile.email}
                <p class="profile-email">{userProfile.email}</p>
              {/if}
              
              <div class="friend-status">
                {#if friendStatus === 'self'}
                  <span class="status-badge self">Your Profile</span>
                {:else if friendStatus === 'friends'}
                  <span class="status-badge friends">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    Friends
                  </span>
                {:else if friendStatus === 'pending_outgoing'}
                  <span class="status-badge pending">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    Request Sent
                  </span>
                {:else if friendStatus === 'pending_incoming'}
                  <span class="status-badge pending">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="8.5" cy="7" r="4"></circle>
                      <line x1="20" y1="8" x2="20" y2="14"></line>
                      <line x1="23" y1="11" x2="17" y2="11"></line>
                    </svg>
                    Request Received
                  </span>
                {/if}
              </div>
            </div>
            
            <div class="profile-actions">
              {#if friendStatus === 'none'}
                {#if !showRequestForm}
                  <button 
                    class="btn btn-primary" 
                    on:click={() => showRequestForm = true}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="8.5" cy="7" r="4"></circle>
                      <line x1="20" y1="8" x2="20" y2="14"></line>
                      <line x1="23" y1="11" x2="17" y2="11"></line>
                    </svg>
                    Add Friend
                  </button>
                {/if}
              {:else if friendStatus === 'pending_outgoing'}
                <button 
                  class="btn btn-outline" 
                  on:click={handleCancelRequest}
                  disabled={processingRequest}
                >
                  {#if processingRequest}
                    <span class="loader loader-sm"></span>
                    <span>Processing...</span>
                  {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="8.5" cy="7" r="4"></circle>
                      <line x1="18" y1="8" x2="23" y2="13"></line>
                      <line x1="23" y1="8" x2="18" y2="13"></line>
                    </svg>
                    Cancel Request
                  {/if}
                </button>
              {:else if friendStatus === 'pending_incoming'}
                <div class="action-buttons">
                  <button 
                    class="btn btn-primary" 
                    on:click={handleAcceptRequest}
                    disabled={processingRequest}
                  >
                    {#if processingRequest}
                      <span class="loader loader-sm"></span>
                      <span>Processing...</span>
                    {:else}
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </svg>
                      Accept Request
                    {/if}
                  </button>
                </div>
              {/if}
            </div>
          </div>
          
          {#if userProfile.bio}
            <div class="profile-bio">
              <h3>About</h3>
              <p>{userProfile.bio}</p>
            </div>
          {/if}
          
          {#if showRequestForm}
            <div class="request-form">
              <h3>Send Friend Request</h3>
              
              <div class="form-group">
                <label for="requestMessage">Add a message (optional)</label>
                <textarea 
                  id="requestMessage" 
                  class="input" 
                  rows="3" 
                  placeholder="Hi! I'd like to connect with you on Voilà!"
                  bind:value={requestMessage}
                ></textarea>
              </div>
              
              <div class="form-actions">
                <button 
                  class="btn btn-outline" 
                  on:click={() => showRequestForm = false}
                  disabled={processingRequest}
                >
                  Cancel
                </button>
                
                <button 
                  class="btn btn-primary" 
                  on:click={handleSendRequest}
                  disabled={processingRequest}
                >
                  {#if processingRequest}
                    <span class="loader loader-sm"></span>
                    <span>Sending...</span>
                  {:else}
                    <span>Send Request</span>
                  {/if}
                </button>
              </div>
            </div>
          {/if}
        </div>
        
        {#if successMessage}
          <div class="success-message">
            <svg xmlns="http://www.w3.org/2000/svg" class="success-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span>{successMessage}</span>
          </div>
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
      {/if}
    </div>
  </AuthProvider>
  
  <style>
    .user-profile-page {
      max-width: 800px;
      margin: 0 auto;
      padding: var(--space-4);
      position: relative;
    }
    
    .profile-header {
      margin-bottom: var(--space-4);
    }
    
    .back-link {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--primary-600);
      text-decoration: none;
      transition: color var(--transition-fast);
      font-weight: var(--font-medium);
    }
    
    .back-link:hover {
      color: var(--primary-700);
    }
    
    .profile-card {
      background-color: var(--bg-card);
      border-radius: var(--radius-lg);
      padding: var(--space-6);
      box-shadow: var(--shadow-md);
      margin-bottom: var(--space-6);
    }
    
    .profile-top {
      display: flex;
      align-items: center;
      margin-bottom: var(--space-6);
    }
    
    .profile-avatar {
      width: 96px;
      height: 96px;
      border-radius: 50%;
      overflow: hidden;
      margin-right: var(--space-4);
      flex-shrink: 0;
      box-shadow: var(--shadow-md);
    }
    
    .profile-avatar img {
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
      font-weight: var(--font-semibold);
      font-size: 2rem;
    }
    
    .profile-info {
      flex: 1;
    }
    
    .profile-name {
      font-size: var(--text-2xl);
      color: var(--text-primary);
      margin: 0 0 var(--space-1) 0;
    }
    
    .profile-email {
      color: var(--text-secondary);
      margin: 0 0 var(--space-2) 0;
      font-size: var(--text-sm);
    }
    
    .friend-status {
      display: flex;
      align-items: center;
      margin-top: var(--space-2);
    }
    
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--text-xs);
      font-weight: var(--font-medium);
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-full);
    }
    
    .status-badge.self {
      background-color: var(--neutral-100);
      color: var(--neutral-700);
    }
    
    .status-badge.friends {
      background-color: var(--accent-100);
      color: var(--accent-700);
    }
    
    .status-badge.pending {
      background-color: var(--primary-100);
      color: var(--primary-700);
    }
    
    .profile-actions {
      display: flex;
      gap: var(--space-2);
    }
    
    .action-buttons {
      display: flex;
      gap: var(--space-2);
    }
    
    .profile-bio {
      margin-top: var(--space-6);
      padding-top: var(--space-6);
      border-top: 1px solid var(--neutral-200);
    }
    
    .profile-bio h3 {
      font-size: var(--text-lg);
      margin: 0 0 var(--space-2) 0;
      color: var(--text-primary);
    }
    
    .profile-bio p {
      color: var(--text-secondary);
      line-height: 1.6;
      margin: 0;
    }
    
    .request-form {
      margin-top: var(--space-6);
      padding-top: var(--space-6);
      border-top: 1px solid var(--neutral-200);
    }
    
    .request-form h3 {
      font-size: var(--text-lg);
      margin: 0 0 var(--space-4) 0;
      color: var(--text-primary);
    }
    
    .form-group {
      margin-bottom: var(--space-4);
    }
    
    .form-group label {
      display: block;
      margin-bottom: var(--space-2);
      color: var(--text-secondary);
      font-size: var(--text-sm);
    }
    
    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
    }
    
    .loading-state,
    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      min-height: 300px;
      background-color: var(--bg-card);
      border-radius: var(--radius-lg);
      padding: var(--space-6);
      box-shadow: var(--shadow-md);
    }
    
    .error-icon {
      color: var(--error);
      margin-bottom: var(--space-4);
    }
    
    .error-state h2 {
      color: var(--error);
      margin-bottom: var(--space-2);
    }
    
    .error-state p {
      margin-bottom: var(--space-6);
      color: var(--text-secondary);
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
      animation: fade-in 0.3s ease-in-out;
    }
    
    .success-icon {
      flex-shrink: 0;
    }
    
    @keyframes fade-in {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @media (max-width: 768px) {
      .profile-top {
        flex-direction: column;
        text-align: center;
      }
      
      .profile-avatar {
        margin-right: 0;
        margin-bottom: var(--space-4);
      }
      
      .friend-status {
        justify-content: center;
      }
      
      .profile-actions {
        margin-top: var(--space-4);
        width: 100%;
        justify-content: center;
      }
      
      .action-buttons {
        flex-direction: column;
        width: 100%;
      }
      
      .action-buttons button {
        width: 100%;
      }
      
      .form-actions {
        flex-direction: column;
      }
      
      .form-actions button {
        width: 100%;
      }
      
      .success-message {
        left: 20px;
        right: 20px;
      }
    }
  </style>