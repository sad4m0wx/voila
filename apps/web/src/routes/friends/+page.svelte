<!-- src/routes/friends/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Navbar from '$components/core/Navbar.svelte';
  import PhoneInput from '$components/core/PhoneInput.svelte';
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
  
  let activeTab = 'friends'; // 'friends', 'requests', 'find'
  let error = null;
  
  // Search input
  let searchPhoneValue = '';
  let isSearching = false;
  let searchResults = [];
  let isPhoneValid = false;
  
  onMount(async () => {
    // Check if user is authenticated
    if (!$authStore.user) {
      goto('/auth/login?redirect=/friends');
      return;
    }
    
    // Load real data
    try {
      await loadFriends();
      await loadFriendRequests();
    } catch (err) {
      error = err.message;
    }
  });
  
  // Subscribe to store errors
  $: error = $friendsError || error;
  
  function setActiveTab(tab) {
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
  <Navbar />
  
  <main class="pt-24 pb-12">
    <div class="container mx-auto px-4">
      <div class="max-w-3xl mx-auto">
        <h1 class="text-3xl font-bold text-gray-900 mb-6">Friends</h1>
        
        <!-- Tabs -->
        <div class="mb-6 border-b border-gray-200">
          <div class="flex -mb-px">
            <button
              class={`py-2 px-4 font-medium text-sm focus:outline-none ${activeTab === 'friends' ? 'border-b-2 border-primary-500 text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
              on:click={() => setActiveTab('friends')}
            >
              My Friends
            </button>
            <button
              class={`py-2 px-4 font-medium text-sm focus:outline-none ${activeTab === 'requests' ? 'border-b-2 border-primary-500 text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
              on:click={() => setActiveTab('requests')}
            >
              Requests
            </button>
            <button
              class={`py-2 px-4 font-medium text-sm focus:outline-none ${activeTab === 'find' ? 'border-b-2 border-primary-500 text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
              on:click={() => setActiveTab('find')}
            >
              Find Friends
            </button>
          </div>
        </div>
        
        {#if $isLoading}
          <div class="flex justify-center py-12">
            <svg class="animate-spin h-10 w-10 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        {:else if error}
          <div class="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        {:else}
          {#if activeTab === 'friends'}
            <div class="bg-white rounded-lg shadow-md p-6">
              {#if $friends.length === 0}
                <div class="text-center py-12">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <h2 class="text-xl font-medium text-gray-900 mb-2">No friends yet</h2>
                  <p class="text-gray-500 mb-6">Add friends to easily find meeting spots together</p>
                  <button
                    on:click={() => setActiveTab('find')}
                    class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none"
                  >
                    Find Friends
                  </button>
                </div>
              {:else}
                <ul class="divide-y divide-gray-200">
                  {#each $friends as friend (friend.id)}
                    <li class="py-4 flex justify-between items-center">
                      <div class="flex items-center">
                        {#if friend.photoURL}
                          <img src={friend.photoURL} alt={friend.displayName} class="w-10 h-10 rounded-full" />
                        {:else}
                          <div class="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium">
                            {friend.displayName ? friend.displayName[0].toUpperCase() : 'U'}
                          </div>
                        {/if}
                        <div class="ml-3">
                          <p class="text-sm font-medium text-gray-900">{friend.displayName}</p>
                        </div>
                      </div>
                      <button
                        on:click={() => handleRemoveFriend(friend.id)}
                        class="text-sm text-gray-500 hover:text-red-500"
                      >
                        Remove
                      </button>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          {:else if activeTab === 'requests'}
            <div class="space-y-6">
              <!-- Incoming Requests -->
              <div class="bg-white rounded-lg shadow-md p-6">
                <h2 class="text-lg font-medium text-gray-900 mb-4">Incoming Requests</h2>
                
                {#if $incomingRequests.length === 0}
                  <p class="text-gray-500 text-sm py-4">No incoming friend requests</p>
                {:else}
                  <ul class="divide-y divide-gray-200">
                    {#each $incomingRequests as request (request.id)}
                      <li class="py-4">
                        <div class="flex justify-between items-start">
                          <div>
                            <p class="text-sm font-medium text-gray-900">{request.senderName || 'User'}</p>
                            {#if request.message}
                              <p class="text-sm text-gray-500 mt-1">"{request.message}"</p>
                            {/if}
                          </div>
                          <div class="flex space-x-2">
                            <button
                              on:click={() => handleAcceptRequest(request.id)}
                              class="px-3 py-1 bg-primary-100 text-primary-700 rounded-md text-sm font-medium hover:bg-primary-200"
                            >
                              Accept 
                            </button>
                            <button
                              on:click={() => handleRejectRequest(request.id)}
                              class="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>
              
              <!-- Outgoing Requests -->
              <div class="bg-white rounded-lg shadow-md p-6">
                <h2 class="text-lg font-medium text-gray-900 mb-4">Sent Requests</h2>
                
                {#if $outgoingRequests.length === 0}
                  <p class="text-gray-500 text-sm py-4">No pending friend requests</p>
                {:else}
                  <ul class="divide-y divide-gray-200">
                    {#each $outgoingRequests as request (request.id)}
                      <li class="py-4 flex justify-between items-center">
                        <div>
                          <p class="text-sm font-medium text-gray-900">
                            {request.recipientName || 'User'}
                          </p>
                          <p class="text-xs text-gray-500">
                            Sent {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : ''}
                          </p>
                        </div>
                        <button
                          on:click={() => handleCancelRequest(request.id)}
                          class="text-sm text-gray-500 hover:text-red-500"
                        >
                          Cancel
                        </button>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>
            </div>
          {:else if activeTab === 'find'}
            <div class="bg-white rounded-lg shadow-md p-6">
              <h2 class="text-lg font-medium text-gray-900 mb-4">Find Friends</h2>
              
              <div class="mb-6">
                <div class="flex gap-2">
                  <div class="flex-1">
                    <PhoneInput
                      label="Search by Phone Number"
                      placeholder="Enter phone number"
                      value={searchPhoneValue}
                      on:change={handlePhoneChange}
                      id="phone-search"
                      showValidation={false}
                    />
                  </div>
                  <div class="flex items-end">
                    <button
                      on:click={handleSearch}
                      disabled={isSearching || !isPhoneValid}
                      class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                    >
                      {#if isSearching}
                        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Searching...
                      {:else}
                        Search
                      {/if}
                    </button>
                  </div>
                </div>
                
                {#if searchPhoneValue && isPhoneValid}
                  <p class="text-sm text-gray-600 mt-2">
                    Searching for {formatPhoneNumber(searchPhoneValue)}
                  </p>
                {/if}
              </div>
              
              {#if searchResults.length > 0}
                <h3 class="text-sm font-medium text-gray-700 mb-2">Search Results</h3>
                <ul class="divide-y divide-gray-200">
                  {#each searchResults as user (user.id)}
                    <li class="py-4 flex justify-between items-center">
                      <div class="flex items-center">
                        {#if user.photoURL}
                          <img src={user.photoURL} alt={user.displayName} class="w-10 h-10 rounded-full" />
                        {:else}
                          <div class="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium">
                            {user.displayName ? user.displayName[0].toUpperCase() : 'U'}
                          </div>
                        {/if}
                        <div class="ml-3">
                          <p class="text-sm font-medium text-gray-900">{user.displayName}</p>
                          <p class="text-xs text-gray-500">{user.phoneNumber ? formatPhoneNumber(user.phoneNumber) : ''}</p>
                        </div>
                      </div>
                      <button
                        on:click={() => handleSendRequest(user.id)}
                        class="px-3 py-1 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700"
                      >
                        Add Friend
                      </button>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </main>
</div>