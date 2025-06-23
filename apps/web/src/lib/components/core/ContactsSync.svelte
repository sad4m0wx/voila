<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { 
    requestContactsPermission, 
    checkContactsPermission,
    getDeviceContacts,
    findContactsInApp,
    getSuggestedFriends,
    getExistingFriends
  } from '$lib/services/contactService.js';
  import { friends, outgoingRequests } from '$stores/friends';
  import NativeLoading from '$components/utils/NativeLoading.svelte';
  import { getDeviceInfo } from '$lib/utils/platform.js';

  const dispatch = createEventDispatcher();

  // Props
  export let isVisible = false;

  // State
  let isLoading = false;
  let hasPermission = false;
  let contactSuggestions = [];
  let existingContactFriends = [];
  let error = null;
  let deviceInfo = null;
  let hasSyncedOnce = false;

  onMount(async () => {
    deviceInfo = getDeviceInfo();
    
    // Only check permission if we're on a native device
    if (deviceInfo.isNative) {
      hasPermission = await checkContactsPermission();
    }
  });

  async function syncContacts() {
    if (!deviceInfo.isNative) {
      error = 'Contact sync is only available on mobile devices';
      return;
    }

    isLoading = true;
    error = null;

    try {
      // Request permission if needed
      if (!hasPermission) {
        hasPermission = await requestContactsPermission();
        if (!hasPermission) {
          error = 'Permission denied. You can grant permission in your device settings.';
          return;
        }
      }

      // Get device contacts
      const deviceContacts = await getDeviceContacts();
      
      if (deviceContacts.length === 0) {
        error = 'No contacts found on your device';
        return;
      }

      // Find matches in the app
      const contactMatches = await findContactsInApp(deviceContacts);
      
      // Separate existing friends from suggestions
      existingContactFriends = getExistingFriends(contactMatches, $friends);
      contactSuggestions = getSuggestedFriends(contactMatches, $friends, $outgoingRequests);
      
      hasSyncedOnce = true;
      
      // Emit results to parent component
      dispatch('contacts-synced', {
        suggestions: contactSuggestions,
        existingFriends: existingContactFriends,
        totalContacts: deviceContacts.length,
        totalMatches: contactMatches.length
      });

    } catch (err) {
      console.error('Error syncing contacts:', err);
      error = err.message || 'Failed to sync contacts';
    } finally {
      isLoading = false;
    }
  }

  function sendFriendRequest(userId) {
    dispatch('send-friend-request', { userId });
  }

  function handlePermissionRequest() {
    syncContacts();
  }
</script>

{#if isVisible}
  <div class="mobile-card p-4 mb-4">
    <div class="flex items-center justify-between mb-4">
      <h3 class="mobile-section-title">Find Friends from Contacts</h3>
      {#if deviceInfo?.isNative && hasPermission && !isLoading}
        <button
          on:click={syncContacts}
          class="mobile-btn-ghost text-blue-500 text-sm"
        >
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Refresh
        </button>
      {/if}
    </div>

    {#if error}
      <div class="mobile-alert mobile-alert-error mb-4">
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        {error}
      </div>
    {/if}

    {#if !deviceInfo?.isNative}
      <!-- Web/Browser message -->
      <div class="text-center py-6 text-gray-500">
        <svg class="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
        </svg>
        <p class="text-sm font-medium">Contact sync is available on mobile</p>
        <p class="text-xs text-gray-400 mt-1">Download the mobile app to find friends from your contacts</p>
      </div>
    {:else if !hasPermission && !isLoading}
      <!-- Permission request -->
      <div class="text-center py-6">
        <svg class="w-12 h-12 mx-auto mb-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
        </svg>
        <h4 class="font-medium text-gray-900 mb-2">Find Friends from Your Contacts</h4>
        <p class="text-sm text-gray-600 mb-4">
          Allow Voilà to access your contacts to find friends who are already using the app.
        </p>
        <button
          on:click={handlePermissionRequest}
          class="mobile-btn-primary"
        >
          Allow Contact Access
        </button>
      </div>
    {:else if isLoading}
      <!-- Loading state -->
      <div class="py-6">
        <NativeLoading text="Syncing contacts..." />
      </div>
    {:else if hasSyncedOnce}
      <!-- Results -->
      <div class="space-y-4">
        {#if contactSuggestions.length > 0}
          <div>
            <h4 class="mobile-section-subtitle mb-3">
              Suggested Friends ({contactSuggestions.length})
            </h4>
            <div class="mobile-list">
              {#each contactSuggestions as suggestion (suggestion.userId)}
                <div class="mobile-list-item">
                  {#if suggestion.photoURL}
                    <img 
                      src={suggestion.photoURL} 
                      alt={suggestion.displayName} 
                      class="mobile-avatar mobile-avatar-md mr-3"
                    />
                  {:else}
                    <div class="mobile-avatar mobile-avatar-md bg-blue-100 text-blue-700 font-semibold mr-3 flex items-center justify-center">
                      {suggestion.displayName ? suggestion.displayName[0].toUpperCase() : 'U'}
                    </div>
                  {/if}
                  
                  <div class="flex-1">
                    <p class="font-semibold text-gray-900">{suggestion.displayName}</p>
                    {#if suggestion.contactInfo?.name}
                      <p class="text-xs text-gray-500">In contacts as "{suggestion.contactInfo.name}"</p>
                    {/if}
                  </div>
                  
                  <button
                    on:click={() => sendFriendRequest(suggestion.userId)}
                    class="mobile-btn-primary text-sm"
                  >
                    Add Friend
                  </button>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if existingContactFriends.length > 0}
          <div>
            <h4 class="mobile-section-subtitle mb-3">
              Already Friends ({existingContactFriends.length})
            </h4>
            <div class="mobile-list">
              {#each existingContactFriends as friend (friend.userId)}
                <div class="mobile-list-item">
                  {#if friend.photoURL}
                    <img 
                      src={friend.photoURL} 
                      alt={friend.displayName} 
                      class="mobile-avatar mobile-avatar-md mr-3"
                    />
                  {:else}
                    <div class="mobile-avatar mobile-avatar-md bg-green-100 text-green-700 font-semibold mr-3 flex items-center justify-center">
                      {friend.displayName ? friend.displayName[0].toUpperCase() : 'U'}
                    </div>
                  {/if}
                  
                  <div class="flex-1">
                    <p class="font-semibold text-gray-900">{friend.displayName}</p>
                    {#if friend.contactInfo?.name}
                      <p class="text-xs text-gray-500">In contacts as "{friend.contactInfo.name}"</p>
                    {/if}
                  </div>
                  
                  <div class="text-sm text-green-600 font-medium">
                    ✓ Friends
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if contactSuggestions.length === 0 && existingContactFriends.length === 0}
          <div class="text-center py-6 text-gray-500">
            <svg class="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
            <p class="text-sm font-medium">No matches found</p>
            <p class="text-xs text-gray-400 mt-1">None of your contacts are using Voilà yet</p>
          </div>
        {/if}
      </div>
    {:else}
      <!-- Initial state with permission granted -->
      <div class="text-center py-6">
        <button
          on:click={syncContacts}
          class="mobile-btn-primary"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
          </svg>
          Sync Contacts
        </button>
      </div>
    {/if}
  </div>
{/if} 