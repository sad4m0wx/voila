<script>
    import { createEventDispatcher } from 'svelte';
    import { friends } from '$stores/friends';
    import { currentGroupMembers } from '$stores/groups';
    import { validatePhoneNumber, formatPhoneNumber, getCountryCodes } from '$stores/auth';
    
    const dispatch = createEventDispatcher();
    
    export let isInviting = false;
    
    // State
    let inviteMode = 'friends'; // 'friends' or 'phone'
    let selectedFriends = new Set();
    let phoneNumber = '';
    let selectedCountryCode = '+1';
    let inviteName = '';
    let showCountryDropdown = false;
    let error = '';
    
    const countryCodes = getCountryCodes();
    
    // Computed values
    $: fullPhoneNumber = selectedCountryCode + phoneNumber.replace(/[^\d]/g, '');
    $: isPhoneValid = validatePhoneNumber(fullPhoneNumber);
    $: canInviteFriends = selectedFriends.size > 0;
    $: canInviteByPhone = isPhoneValid && inviteName.trim();
    
    // Filter friends to exclude current group members
    $: availableFriends = $friends.filter(friend => {
      // Check if friend is already a member of the current group
      return !$currentGroupMembers.some(member => member.id === friend.id);
    });
    
    function toggleFriend(friendId) {
      if (selectedFriends.has(friendId)) {
        selectedFriends.delete(friendId);
      } else {
        selectedFriends.add(friendId);
      }
      selectedFriends = new Set(selectedFriends);
    }
    
    function selectCountryCode(code) {
      selectedCountryCode = code;
      showCountryDropdown = false;
    }
    
    function handlePhoneInput(event) {
      const value = event.target.value.replace(/[^\d]/g, '');
      phoneNumber = value;
      error = '';
    }
    
    async function handleInviteFriends() {
      if (!canInviteFriends) {
        error = 'Please select at least one friend to add';
        return;
      }
      
      const friendIds = Array.from(selectedFriends);
      dispatch('invite-friends', { friendIds });
      
      // Reset form
      selectedFriends = new Set();
    }
    
    async function handleInviteByPhone() {
      if (!canInviteByPhone) {
        error = 'Please enter a valid phone number and name';
        return;
      }
      
      dispatch('invite-by-phone', {
        phoneNumber: fullPhoneNumber,
        name: inviteName.trim()
      });
      
      // Reset form
      phoneNumber = '';
      inviteName = '';
      error = '';
    }
    
    function setInviteMode(mode) {
      inviteMode = mode;
      error = '';
      // Reset forms when switching modes
      selectedFriends = new Set();
      phoneNumber = '';
      inviteName = '';
    }
  </script>
  
  <div class="bg-white shadow rounded-lg p-6 mb-6">
    <h2 class="text-lg font-medium text-gray-900 mb-4">Add Members</h2>
    
    <!-- Mode Selection -->
    <div class="flex mb-4 border-b border-gray-200">
      <button
        type="button"
        class={`py-2 px-4 font-medium text-sm focus:outline-none border-b-2 ${
          inviteMode === 'friends' 
            ? 'border-primary-500 text-primary-600' 
            : 'border-transparent text-gray-500 hover:text-gray-700'
        }`}
        on:click={() => setInviteMode('friends')}
      >
        Add Friends
      </button>
      <button
        type="button"
        class={`py-2 px-4 font-medium text-sm focus:outline-none border-b-2 ${
          inviteMode === 'phone' 
            ? 'border-primary-500 text-primary-600' 
            : 'border-transparent text-gray-500 hover:text-gray-700'
        }`}
        on:click={() => setInviteMode('phone')}
      >
        Invite by Phone
      </button>
    </div>
    
    {#if error}
      <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
        <div class="flex items-center">
          <svg class="w-4 h-4 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-sm text-red-800">{error}</span>
        </div>
      </div>
    {/if}
    
    {#if inviteMode === 'friends'}
      <!-- Add Friends Mode -->
      {#if availableFriends.length > 0}
        <div class="space-y-2 mb-4 max-h-48 overflow-y-auto">
          {#each availableFriends as friend (friend.id)}
            <label class="flex items-center p-2 hover:bg-gray-50 rounded-md cursor-pointer">
              <input
                type="checkbox"
                class="form-checkbox h-4 w-4 text-primary-600"
                checked={selectedFriends.has(friend.id)}
                on:change={() => toggleFriend(friend.id)}
                disabled={isInviting}
              />
              <div class="ml-3 flex items-center">
                {#if friend.photoURL}
                  <img src={friend.photoURL} alt={friend.displayName} class="w-8 h-8 rounded-full mr-3" />
                {:else}
                  <div class="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-medium mr-3">
                    {friend.displayName ? friend.displayName.charAt(0).toUpperCase() : '?'}
                  </div>
                {/if}
                <div>
                  <p class="text-sm font-medium text-gray-900">{friend.displayName}</p>
                  {#if friend.phoneNumber}
                    <p class="text-xs text-gray-500">{formatPhoneNumber(friend.phoneNumber)}</p>
                  {/if}
                </div>
              </div>
            </label>
          {/each}
        </div>
        
        <button
          type="button"
          on:click={handleInviteFriends}
          disabled={!canInviteFriends || isInviting}
          class="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if isInviting}
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Adding Friends...
          {:else}
            Add Selected Friends ({selectedFriends.size})
          {/if}
        </button>
      {:else}
        <div class="text-center py-8 text-gray-500">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          {#if $friends.length === 0}
            <p class="text-sm">No friends to add</p>
            <p class="text-xs text-gray-400 mt-1">Add friends first or invite by phone number</p>
          {:else}
            <p class="text-sm">All friends are already in this group</p>
            <p class="text-xs text-gray-400 mt-1">Invite new people by phone number</p>
          {/if}
        </div>
      {/if}
      
    {:else if inviteMode === 'phone'}
      <!-- Invite by Phone Mode -->
      <div class="space-y-4">
        <div>
          <label for="invite-name" class="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            type="text"
            id="invite-name"
            bind:value={inviteName}
            placeholder="Enter person's name"
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            disabled={isInviting}
          />
        </div>
        
        <div>
          <label for="phone" class="block text-sm font-medium text-gray-700 mb-1">
            Phone Number
          </label>
          
          <div class="flex">
            <!-- Country Code Dropdown -->
            <div class="relative">
              <button
                type="button"
                class="flex items-center px-3 py-2 border border-r-0 border-gray-300 rounded-l-md bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                on:click={() => showCountryDropdown = !showCountryDropdown}
                disabled={isInviting}
              >
                <span class="text-sm font-medium">{selectedCountryCode}</span>
                <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {#if showCountryDropdown}
                <div class="absolute top-full left-0 z-10 w-48 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {#each countryCodes as country}
                    <button
                      type="button"
                      class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center"
                      on:click={() => selectCountryCode(country.code)}
                    >
                      <span class="mr-2">{country.flag}</span>
                      <span class="mr-2 font-medium">{country.code}</span>
                      <span class="text-gray-500">{country.country}</span>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
            
            <!-- Phone Number Input -->
            <input
              type="tel"
              id="phone"
              class="flex-1 px-3 py-2 border border-gray-300 rounded-r-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Enter phone number"
              bind:value={phoneNumber}
              on:input={handlePhoneInput}
              disabled={isInviting}
              autocomplete="tel"
            />
          </div>
          
          {#if fullPhoneNumber && isPhoneValid}
            <p class="text-sm text-gray-600 mt-1">
              Will invite {formatPhoneNumber(fullPhoneNumber)}
            </p>
          {/if}
        </div>
        
        <button
          type="button"
          on:click={handleInviteByPhone}
          disabled={!canInviteByPhone || isInviting}
          class="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if isInviting}
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Sending Invite...
          {:else}
            Send Invitation
          {/if}
        </button>
      </div>
    {/if}
  </div>
  
  <!-- Click outside to close dropdown -->
  {#if showCountryDropdown}
    <div 
      class="fixed inset-0 z-5" 
      on:click={() => showCountryDropdown = false}
    ></div>
  {/if}