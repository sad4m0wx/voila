<script>
  import { onMount, getContext } from 'svelte';
  import { goto } from '$app/navigation';
  import ResponsiveHeader from '$components/core/ResponsiveHeader.svelte';
  import PhoneInput from '$components/core/PhoneInput.svelte';
  import LoadingIndicator from '$components/utils/LoadingIndicator.svelte';
  import ContactsSync from '$components/core/ContactsSync.svelte';
  import { authStore, formatPhoneNumber } from '$stores/auth';
  
  import { 
    friends, 
    incomingRequests, 
    outgoingRequests, 
    isLoading, 
    error as friendsError,
    loadFriends, 
    loadFriendRequests, 
    sendRequest,
    acceptRequest,
    rejectRequest,
    cancelRequest,
    removeUserFriend,
    searchForUsers
  } from '$stores/friends';
  
  const isMobile = getContext("isMobile") || true;
  
  let activeTab = 'friends';
  let error = null;
  let searchPhoneValue = '';
  let isSearching = false;
  let searchResults = [];
  let isPhoneValid = false;
  
  onMount(async () => {
    // Redirect to login if not authenticated
    if (!$authStore.user && !$authStore.isLoading) {
      goto('/auth/login?redirect=/friends');
      return;
    }

    if ($authStore.isLoading) {
      const unsubscribe = authStore.subscribe(auth => {
        if (!auth.isLoading) {
          unsubscribe();
          if (!auth.user) {
            goto('/auth/login?redirect=/friends');
            return;
          }
          loadFriendsData();
        }
      });
    } else {
      loadFriendsData();
    }
  });

  async function loadFriendsData() {
    try {
      await loadFriends();
      await loadFriendRequests();
    } catch (err) {
      error = err.message;
    }
  }
  
  $: error = $friendsError || error;
  
  async function setActiveTab(tab) {
    activeTab = tab;
  }
  
  async function handleSearch() {
    if (!isPhoneValid) {
      error = 'Please enter a valid phone number';
      return;
    }
    
    isSearching = true;
    error = null;
    
    try {
      searchResults = await searchForUsers(searchPhoneValue);
    } catch (err) {
      error = err.message || 'Failed to search for users';
    } finally {
      isSearching = false;
    }
  }
  
  function handlePhoneChange(event) {
    searchPhoneValue = event.detail.value;
    isPhoneValid = event.detail.isValid;
    error = null;
  }

  function handleContactsSynced(event) {
    const { suggestions, existingFriends, totalContacts, totalMatches } = event.detail;
    console.log(`Found ${totalMatches} matches out of ${totalContacts} contacts`);
    console.log(`${suggestions.length} new suggestions, ${existingFriends.length} existing friends`);
  }

  function handleContactFriendRequest(event) {
    const { userId } = event.detail;
    handleSendRequest(userId);
  }
  
  async function handleSendRequest(userId) {
    try {
      await sendRequest(userId);
      searchResults = searchResults.filter(u => u.id !== userId);
    } catch (err) {
      error = err.message;
    }
  }
  
  async function handleAcceptRequest(requestId) {
    try {
      await acceptRequest(requestId);
    } catch (err) {
      error = err.message;
    }
  }
  
  async function handleRejectRequest(requestId) {
    try {
      await rejectRequest(requestId);
    } catch (err) {
      error = err.message;
    }
  }
  
  async function handleCancelRequest(requestId) {
    try {
      await cancelRequest(requestId);
    } catch (err) {
      error = err.message;
    }
  }
  
  async function handleRemoveFriend(friendId) {
    try {
      await removeUserFriend(friendId);
    } catch (err) {
      error = err.message;
    }
  }
</script>

<svelte:head>
  <title>Friends | Voilà!</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <ResponsiveHeader title="Friends" />
  
  <main class="mobile-section pt-4 pb-24">
    <!-- Tab Navigation -->
    <div class="mobile-card mb-4 p-1">
      <div class="flex rounded-xl bg-gray-100">
        <button
          class="flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all duration-200 {activeTab === 'friends' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'}"
          on:click={() => setActiveTab('friends')}
        >
          My Friends
          {#if $friends.length > 0}
            <span class="mobile-badge mobile-badge-primary ml-2">{$friends.length}</span>
          {/if}
        </button>
        <button
          class="flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all duration-200 {activeTab === 'requests' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'}"
          on:click={() => setActiveTab('requests')}
        >
          Requests
          {#if $incomingRequests.length > 0}
            <span class="mobile-badge mobile-badge-warning ml-2">{$incomingRequests.length}</span>
          {/if}
        </button>
        <button
          class="flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-all duration-200 {activeTab === 'find' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'}"
          on:click={() => setActiveTab('find')}
        >
          Find
        </button>
      </div>
    </div>

    {#if error}
      <div class="mobile-card p-4 mb-4 border-l-4 border-red-500 bg-red-50">
        <div class="flex items-center">
          <svg class="w-5 h-5 text-red-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p class="text-red-700 text-sm font-medium">{error}</p>
        </div>
      </div>
    {/if}

    {#if $isLoading}
      <div class="mobile-card p-8">
        <LoadingIndicator variant="native" text="Loading friends..." />
      </div>
    {:else if activeTab === 'friends'}
      <!-- Friends List -->
      {#if $friends.length === 0}
        <div class="mobile-empty-state">
          <div class="mobile-empty-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
          </div>
          <h3 class="mobile-empty-title">No friends yet</h3>
          <p class="mobile-empty-description">Add friends to easily find meeting spots together</p>
          <button
            on:click={() => setActiveTab('find')}
            class="mobile-btn-primary"
          >
            Find Friends
          </button>
        </div>
      {:else}
        <div class="mobile-list">
          {#each $friends as friend (friend.id)}
            <div class="mobile-list-item">
              <!-- Avatar -->
              {#if friend.photoURL}
                <img 
                  src={friend.photoURL} 
                  alt={friend.displayName} 
                  class="mobile-avatar mobile-avatar-md mr-3"
                />
              {:else}
                <div class="mobile-avatar mobile-avatar-md bg-blue-100 text-blue-700 font-semibold mr-3 flex items-center justify-center">
                  {friend.displayName ? friend.displayName[0].toUpperCase() : 'U'}
                </div>
              {/if}
              
              <!-- Friend Info -->
              <div class="flex-1">
                <p class="font-semibold text-gray-900">{friend.displayName}</p>
                <p class="text-sm text-gray-500">Friend</p>
              </div>
              
              <!-- Actions -->
              <button
                on:click={() => handleRemoveFriend(friend.id)}
                class="mobile-btn-ghost text-red-500 text-sm"
              >
                Remove
              </button>
            </div>
          {/each}
        </div>
      {/if}
      
    {:else if activeTab === 'requests'}
      <!-- Friend Requests -->
      <div class="space-y-4">
        <!-- Incoming Requests -->
        {#if $incomingRequests.length > 0}
          <div>
            <h3 class="mobile-section-title mb-3">Incoming Requests</h3>
            <div class="mobile-list">
              {#each $incomingRequests as request (request.id)}
                <div class="mobile-list-item flex-col items-start">
                  <div class="flex items-center w-full mb-3">
                    <div class="mobile-avatar mobile-avatar-md bg-gray-100 text-gray-700 font-semibold mr-3 flex items-center justify-center">
                      {request.senderName ? request.senderName[0].toUpperCase() : 'U'}
                    </div>
                    <div class="flex-1">
                      <p class="font-semibold text-gray-900">{request.senderName || 'User'}</p>
                      {#if request.message}
                        <p class="text-sm text-gray-500 italic">"{request.message}"</p>
                      {/if}
                    </div>
                  </div>
                  <div class="flex space-x-2 w-full">
                    <button
                      on:click={() => handleAcceptRequest(request.id)}
                      class="flex-1 mobile-btn-primary"
                    >
                      Accept
                    </button>
                    <button
                      on:click={() => handleRejectRequest(request.id)}
                      class="flex-1 mobile-btn-secondary"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
        
        <!-- Outgoing Requests -->
        {#if $outgoingRequests.length > 0}
          <div>
            <h3 class="mobile-section-title mb-3">Sent Requests</h3>
            <div class="mobile-list">
              {#each $outgoingRequests as request (request.id)}
                <div class="mobile-list-item">
                  <div class="mobile-avatar mobile-avatar-md bg-gray-100 text-gray-700 font-semibold mr-3 flex items-center justify-center">
                    {request.recipientName ? request.recipientName[0].toUpperCase() : 'U'}
                  </div>
                  <div class="flex-1">
                    <p class="font-semibold text-gray-900">{request.recipientName || 'User'}</p>
                    <p class="text-xs text-gray-500">
                      Sent {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : ''}
                    </p>
                  </div>
                  <button
                    on:click={() => handleCancelRequest(request.id)}
                    class="mobile-btn-ghost text-red-500 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              {/each}
            </div>
          </div>
        {/if}
        
        {#if $incomingRequests.length === 0 && $outgoingRequests.length === 0}
          <div class="mobile-empty-state">
            <div class="mobile-empty-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
              </svg>
            </div>
            <h3 class="mobile-empty-title">No friend requests</h3>
            <p class="mobile-empty-description">You're all caught up!</p>
          </div>
        {/if}
      </div>
      
    {:else if activeTab === 'find'}
      <!-- Find Friends -->
      <div>
        <!-- Contact Sync Section -->
        <ContactsSync 
          isVisible={true}
          on:contacts-synced={handleContactsSynced}
          on:send-friend-request={handleContactFriendRequest}
        />
        
        <h3 class="mobile-section-title mb-4">Find Friends by Phone</h3>
        
        <div class="mobile-card p-4 mb-4">
          <div class="space-y-4">
            <PhoneInput
              label="Phone Number"
              placeholder="Enter phone number"
              value={searchPhoneValue}
              on:change={handlePhoneChange}
              id="phone-search"
              showValidation={false}
            />
            
            <button
              on:click={handleSearch}
              disabled={isSearching || !isPhoneValid}
              class="w-full mobile-btn-primary disabled:opacity-50"
            >
              {#if isSearching}
                <svg class="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Searching...
              {:else}
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                Search
              {/if}
            </button>
            
            {#if searchPhoneValue && isPhoneValid}
              <p class="text-sm text-gray-500 text-center">
                Searching for {formatPhoneNumber(searchPhoneValue)}
              </p>
            {/if}
          </div>
        </div>
        
        {#if searchResults.length > 0}
          <div>
            <h4 class="mobile-section-subtitle mb-3">Search Results</h4>
            <div class="mobile-list">
              {#each searchResults as user (user.id)}
                <div class="mobile-list-item">
                  {#if user.photoURL}
                    <img 
                      src={user.photoURL} 
                      alt={user.displayName} 
                      class="mobile-avatar mobile-avatar-md mr-3"
                    />
                  {:else}
                    <div class="mobile-avatar mobile-avatar-md bg-blue-100 text-blue-700 font-semibold mr-3 flex items-center justify-center">
                      {user.displayName ? user.displayName[0].toUpperCase() : 'U'}
                    </div>
                  {/if}
                  
                  <div class="flex-1">
                    <p class="font-semibold text-gray-900">{user.displayName}</p>
                    <p class="text-xs text-gray-500">{user.phoneNumber ? formatPhoneNumber(user.phoneNumber) : ''}</p>
                  </div>
                  
                  <button
                    on:click={() => handleSendRequest(user.id)}
                    class="mobile-btn-primary"
                  >
                    Add Friend
                  </button>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </main>
</div>