<!-- src/lib/components/groups/InviteUser.svelte -->
<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { goto } from '$app/navigation';
  import { currentGroup, inviteUser, isLoading } from '$stores/groups';
  import { friends, loadFriends } from '$stores/friends';
  import { searchForUsers } from '$stores/friends';
  
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

<div class="max-w-2xl mx-auto">
  <div class="mb-6">
    <button 
      class="flex items-center text-primary-600 hover:text-primary-700 font-medium transition-colors"
      on:click={returnToGroup}
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="19" y1="12" x2="5" y2="12"></line>
        <polyline points="12 19 5 12 12 5"></polyline>
      </svg>
      <span>Back to Group</span>
    </button>
    
    <h2 class="text-2xl font-bold text-gray-900 mt-2">Invite to {$currentGroup ? $currentGroup.name : 'Group'}</h2>
  </div>
  
  {#if error}
    <div class="flex items-center p-4 mb-6 text-sm text-red-700 bg-red-50 rounded-md border-l-4 border-red-500">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span>{error}</span>
    </div>
  {/if}
  
  {#if success}
    <div class="flex items-center p-4 mb-6 text-sm text-green-700 bg-green-50 rounded-md border-l-4 border-green-500">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <span>{success}</span>
    </div>
  {/if}
  
  <div class="mb-6 border-b border-gray-200">
    <div class="flex -mb-px">
      <button
        class={`py-2 px-4 font-medium text-sm ${activeTab === 'friends' 
          ? 'border-b-2 border-primary-500 text-primary-600' 
          : 'text-gray-500 hover:text-gray-700'}`}
        on:click={() => setActiveTab('friends')}
      >
        <div class="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <span>Invite Friends</span>
        </div>
      </button>
      
      <button
        class={`py-2 px-4 font-medium text-sm ${activeTab === 'email' 
          ? 'border-b-2 border-primary-500 text-primary-600' 
          : 'text-gray-500 hover:text-gray-700'}`}
        on:click={() => setActiveTab('email')}
      >
        <div class="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          <span>Invite by Email</span>
        </div>
      </button>
    </div>
  </div>
  
  <div>
    {#if activeTab === 'friends'}
      <div>
        {#if $friends.length === 0}
          <div class="flex flex-col items-center justify-center p-6 text-center text-gray-600 bg-gray-50 rounded-lg">
            <p>You don't have any friends yet. Add some friends or use the email tab to invite people.</p>
          </div>
        {:else}
          <div class="mb-4">
            <h3 class="text-sm font-medium text-gray-700 mb-2">Select friends to invite:</h3>
            <div class="max-h-72 overflow-y-auto border border-gray-200 rounded-md p-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {#each $friends as friend (friend.id)}
                <!-- Skip already selected friends -->
                {#if !($currentGroup && $currentGroup.members.includes(friend.id))}
                  <div 
                    class={`p-3 rounded-md cursor-pointer flex flex-col items-center text-center ${selectedFriends.includes(friend.id) 
                      ? 'bg-primary-100 border border-primary-300' 
                      : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'}`}
                    on:click={() => toggleFriendSelection(friend.id)}
                  >
                    <div class="mb-2">
                      {#if friend.photoURL}
                        <img src={friend.photoURL} alt={friend.displayName} class="h-12 w-12 rounded-full" />
                      {:else}
                        <div class="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium text-lg">
                          {friend.displayName ? friend.displayName[0].toUpperCase() : '?'}
                        </div>
                      {/if}
                    </div>
                    
                    <div>
                      <p class="font-medium text-sm text-gray-900 truncate max-w-full">{friend.displayName || 'User'}</p>
                      
                      {#if selectedFriends.includes(friend.id)}
                        <div class="absolute top-2 right-2 bg-primary-500 text-white rounded-full p-1 w-5 h-5 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </div>
                      {/if}
                    </div>
                  </div>
                {/if}
              {/each}
            </div>
          </div>
          
          <div class="mb-6">
            <label for="friendMessage" class="block text-sm font-medium text-gray-700 mb-2">Add a message (optional)</label>
            <textarea 
              id="friendMessage" 
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" 
              bind:value={messageInput} 
              placeholder="Write a personal message to include with your invitation"
              rows="3"
            ></textarea>
          </div>
          
          <div class="flex justify-between gap-4">
            <button 
              class="px-4 py-2 font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              on:click={returnToGroup}
            >
              Cancel
            </button>
            
            <button 
              class="px-4 py-2 font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              on:click={inviteFriends}
              disabled={$isLoading || selectedFriends.length === 0}
            >
              {#if $isLoading}
                <div class="inline-block w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Sending Invites...</span>
              {:else}
                <span>Send {selectedFriends.length} {selectedFriends.length === 1 ? 'Invite' : 'Invites'}</span>
              {/if}
            </button>
          </div>
        {/if}
      </div>
    {:else if activeTab === 'email'}
      <div>
        <div class="mb-6">
          <label for="emailInput" class="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
          <div class="flex">
            <input 
              type="email" 
              id="emailInput" 
              class="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" 
              bind:value={emailInput} 
              placeholder="Enter email address"
              on:keydown={(e) => e.key === 'Enter' && searchUsers()}
            />
            
            <button 
              class="flex items-center px-4 py-2 font-medium text-white bg-primary-600 rounded-r-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              on:click={searchUsers}
              disabled={isSearching || !emailInput.trim()}
            >
              {#if isSearching}
                <div class="inline-block w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Searching...</span>
              {:else}
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <span>Search</span>
              {/if}
            </button>
          </div>
        </div>
        
        {#if searchResults.length > 0}
          <div class="mb-6 p-4 bg-gray-50 rounded-lg">
            <h4 class="text-sm font-medium text-gray-700 mb-3">User Found</h4>
            {#each searchResults as user (user.id)}
              <div class="flex items-center bg-white p-4 rounded-md shadow-sm">
                <div class="mr-3 flex-shrink-0">
                  {#if user.photoURL}
                    <img src={user.photoURL} alt={user.displayName} class="h-12 w-12 rounded-full" />
                  {:else}
                    <div class="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium text-lg">
                      {user.displayName ? user.displayName[0].toUpperCase() : '?'}
                    </div>
                  {/if}
                </div>
                
                <div>
                  <p class="font-medium text-gray-900">{user.displayName || 'User'}</p>
                  <p class="text-xs text-gray-500">{user.email}</p>
                </div>
              </div>
            {/each}
          </div>
        {/if}
        
        <div class="mb-6">
          <label for="emailMessage" class="block text-sm font-medium text-gray-700 mb-2">Add a message (optional)</label>
          <textarea 
            id="emailMessage" 
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" 
            bind:value={messageInput} 
            placeholder="Write a personal message to include with your invitation"
            rows="3"
          ></textarea>
        </div>
        
        <div class="flex justify-between gap-4">
          <button 
            class="px-4 py-2 font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            on:click={returnToGroup}
          >
            Cancel
          </button>
          
          <button 
            class="px-4 py-2 font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            on:click={inviteByEmail}
            disabled={$isLoading || !emailInput.trim()}
          >
            {#if $isLoading}
              <div class="inline-block w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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