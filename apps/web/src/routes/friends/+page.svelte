<!-- src/routes/friends/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Navbar from '$lib/components/Navbar.svelte';
  import { isAuthenticated } from '$lib/stores/auth';
  
  let activeTab = 'friends'; // 'friends', 'requests', 'find'
  let isLoading = true;
  let error = null;
  
  // Mock data
  let friends = [];
  let incomingRequests = [];
  let outgoingRequests = [];
  let searchResults = [];
  
  // Search input
  let searchEmail = '';
  let isSearching = false;
  
  onMount(async () => {
    // Check if user is authenticated
    if (!$isAuthenticated) {
      goto('/login?redirect=/friends');
      return;
    }
    
    // Simulate loading data
    setTimeout(() => {
      isLoading = false;
    }, 1000);
  });
  
  function setActiveTab(tab) {
    activeTab = tab;
  }
  
  async function searchUsers() {
    if (!searchEmail || !searchEmail.includes('@')) {
      error = 'Please enter a valid email address';
      return;
    }
    
    isSearching = true;
    error = null;
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock response
      searchResults = [
        {
          id: 'user1',
          displayName: 'Jane Smith',
          email: searchEmail,
          photoURL: null
        }
      ];
    } catch (err) {
      error = err.message || 'Failed to search for users';
    } finally {
      isSearching = false;
    }
  }
  
  async function sendFriendRequest(userId) {
    // Mock sending friend request
    outgoingRequests = [
      ...outgoingRequests,
      {
        id: 'req1',
        userId,
        userName: searchResults.find(u => u.id === userId)?.displayName || 'User',
        date: new Date()
      }
    ];
    
    searchResults = searchResults.filter(u => u.id !== userId);
  }
  
  function acceptRequest(requestId) {
    const request = incomingRequests.find(r => r.id === requestId);
    if (request) {
      friends = [
        ...friends,
        {
          id: request.userId,
          displayName: request.userName,
          photoURL: null
        }
      ];
      incomingRequests = incomingRequests.filter(r => r.id !== requestId);
    }
  }
  
  function rejectRequest(requestId) {
    incomingRequests = incomingRequests.filter(r => r.id !== requestId);
  }
  
  function cancelRequest(requestId) {
    outgoingRequests = outgoingRequests.filter(r => r.id !== requestId);
  }
  
  function removeFriend(friendId) {
    friends = friends.filter(f => f.id !== friendId);
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
        
        {#if isLoading}
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
              {#if friends.length === 0}
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
                  {#each friends as friend (friend.id)}
                    <li class="py-4 flex justify-between items-center">
                      <div class="flex items-center">
                        <div class="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium">
                          {friend.displayName ? friend.displayName[0].toUpperCase() : 'U'}
                        </div>
                        <div class="ml-3">
                          <p class="text-sm font-medium text-gray-900">{friend.displayName}</p>
                        </div>
                      </div>
                      <button
                        on:click={() => removeFriend(friend.id)}
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
            <div class="bg-white rounded-lg shadow-md p-6">
              {#if incomingRequests.length === 0 && outgoingRequests.length === 0}
                <div class="text-center py-12">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <h2 class="text-xl font-medium text-gray-900 mb-2">No friend requests</h2>
                  <p class="text-gray-500">You don't have any pending friend requests</p>
                </div>
              {:else}
                {#if incomingRequests.length > 0}
                  <h3 class="font-medium text-gray-900 mb-3">Incoming Requests</h3>
                  <ul class="divide-y divide-gray-200 mb-6">
                    {#each incomingRequests as request (request.id)}
                      <li class="py-4">
                        <div class="flex justify-between items-center">
                          <div class="flex items-center">
                            <div class="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium">
                              {request.userName ? request.userName[0].toUpperCase() : 'U'}
                            </div>
                            <div class="ml-3">
                              <p class="text-sm font-medium text-gray-900">{request.userName}</p>
                            </div>
                          </div>
                          <div class="flex space-x-2">
                            <button
                              on:click={() => acceptRequest(request.id)}
                              class="px-3 py-1 bg-primary-100 text-primary-700 rounded-md text-sm font-medium hover:bg-primary-200"
                            >
                              Accept
                            </button>
                            <button
                              on:click={() => rejectRequest(request.id)}
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
                
                {#if outgoingRequests.length > 0}
                  <h3 class="font-medium text-gray-900 mb-3">Outgoing Requests</h3>
                  <ul class="divide-y divide-gray-200">
                    {#each outgoingRequests as request (request.id)}
                      <li class="py-4 flex justify-between items-center">
                        <div class="flex items-center">
                          <div class="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium">
                            {request.userName ? request.userName[0].toUpperCase() : 'U'}
                          </div>
                          <div class="ml-3">
                            <p class="text-sm font-medium text-gray-900">{request.userName}</p>
                            <p class="text-sm text-gray-500">Pending</p>
                          </div>
                        </div>
                        <button
                          on:click={() => cancelRequest(request.id)}
                          class="text-sm text-gray-500 hover:text-red-500"
                        >
                          Cancel
                        </button>
                      </li>
                    {/each}
                  </ul>
                {/if}
              {/if}
            </div>
          {:else if activeTab === 'find'}
            <div class="bg-white rounded-lg shadow-md p-6">
              <h2 class="text-lg font-medium text-gray-900 mb-4">Find Friends</h2>
              <p class="text-gray-500 mb-4">Search for friends by their email address</p>
              
              <div class="mb-6">
                <div class="flex space-x-3">
                  <input
                    type="email"
                    placeholder="Enter email address"
                    bind:value={searchEmail}
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                  <button
                    on:click={searchUsers}
                    disabled={isSearching || !searchEmail}
                    class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {#if isSearching}
                      <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    {:else}
                      Search
                    {/if}
                  </button>
                </div>
              </div>
              
              {#if searchResults.length > 0}
                <h3 class="font-medium text-gray-900 mb-3">Search Results</h3>
                <ul class="divide-y divide-gray-200">
                  {#each searchResults as user (user.id)}
                    <li class="py-4 flex justify-between items-center">
                      <div class="flex items-center">
                        <div class="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium">
                          {user.displayName ? user.displayName[0].toUpperCase() : 'U'}
                        </div>
                        <div class="ml-3">
                          <p class="text-sm font-medium text-gray-900">{user.displayName}</p>
                          <p class="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                      <button
                        on:click={() => sendFriendRequest(user.id)}
                        class="px-3 py-1 bg-primary-100 text-primary-700 rounded-md text-sm font-medium hover:bg-primary-200"
                      >
                        Add Friend
                      </button>
                    </li>
                  {/each}
                </ul>
              {:else if isSearching === false && searchEmail}
                <div class="text-center py-6 bg-gray-50 rounded-lg">
                  <p class="text-gray-500">No results found for this email.</p>
                </div>
              {/if}
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </main>
</div>