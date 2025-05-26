<script>
    import { createEventDispatcher, onMount } from 'svelte';
    import { friends, loadFriends } from '$stores/friends';
    import { authStore } from '$stores/auth';
    
    const dispatch = createEventDispatcher();
    
    export let show = false;
    export let isCreating = false;
    
    // Form state
    let groupName = '';
    let groupDescription = '';
    let selectedFriends = new Set();
    let error = null;
    
    // Load friends when modal opens
    $: if (show && $friends.length === 0) {
      loadFriends();
    }
    
    function toggleFriend(friendId) {
      if (selectedFriends.has(friendId)) {
        selectedFriends.delete(friendId);
      } else {
        selectedFriends.add(friendId);
      }
      selectedFriends = new Set(selectedFriends); // Trigger reactivity
    }
    
    function handleSubmit() {
      if (!groupName.trim()) {
        error = 'Group name is required';
        return;
      }
      
      const groupData = {
        name: groupName.trim(),
        description: groupDescription.trim(),
      };
      
      const initialMembers = Array.from(selectedFriends);
      
      dispatch('create-group', { groupData, initialMembers });
    }
    
    function handleCancel() {
      // Reset form
      groupName = '';
      groupDescription = '';
      selectedFriends = new Set();
      error = null;
      
      dispatch('cancel');
    }
    
    // Reset form when modal is closed
    $: if (!show) {
      groupName = '';
      groupDescription = '';
      selectedFriends = new Set();
      error = null;
    }
  </script>
  
  {#if show}
    <div class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <!-- Background overlay -->
        <div
          class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          on:click={handleCancel}
          aria-hidden="true"
        ></div>
  
        <!-- Modal panel -->
        <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div class="sm:flex sm:items-start">
              <div class="mt-3 text-center sm:mt-0 sm:text-left w-full">
                <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4" id="modal-title">
                  Create a New Group
                </h3>
                
                <div class="space-y-4">
                  {#if error}
                    <div class="bg-red-50 border-l-4 border-red-500 p-4">
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
                  {/if}
  
                  <!-- Group Name -->
                  <div>
                    <label for="group-name" class="block text-sm font-medium text-gray-700">
                      Group Name <span class="text-red-500">*</span>
                    </label>
                    <div class="mt-1">
                      <input
                        type="text"
                        id="group-name"
                        bind:value={groupName}
                        placeholder="Enter group name"
                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        required
                        disabled={isCreating}
                      />
                    </div>
                  </div>
  
                  <!-- Group Description -->
                  <div>
                    <label for="group-description" class="block text-sm font-medium text-gray-700">
                      Description (optional)
                    </label>
                    <div class="mt-1">
                      <textarea
                        id="group-description"
                        bind:value={groupDescription}
                        rows="2"
                        placeholder="Describe your group's purpose"
                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        disabled={isCreating}
                      ></textarea>
                    </div>
                  </div>
  
                  <!-- Friend Selection -->
                  <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                      Add Friends to Group (optional)
                    </label>
                    
                    {#if $friends.length > 0}
                      <div class="max-h-48 overflow-y-auto border border-gray-200 rounded-md p-2">
                        {#each $friends as friend (friend.id)}
                          <label class="flex items-center p-2 hover:bg-gray-50 rounded-md cursor-pointer">
                            <input
                              type="checkbox"
                              class="form-checkbox h-4 w-4 text-primary-600 transition duration-150 ease-in-out"
                              checked={selectedFriends.has(friend.id)}
                              on:change={() => toggleFriend(friend.id)}
                              disabled={isCreating}
                            />
                            <div class="ml-3 flex items-center">
                              {#if friend.photoURL}
                                <img src={friend.photoURL} alt={friend.displayName} class="w-6 h-6 rounded-full mr-2" />
                              {:else}
                                <div class="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-medium mr-2">
                                  {friend.displayName ? friend.displayName.charAt(0).toUpperCase() : '?'}
                                </div>
                              {/if}
                              <span class="text-sm text-gray-900">{friend.displayName}</span>
                            </div>
                          </label>
                        {/each}
                      </div>
                      
                      {#if selectedFriends.size > 0}
                        <p class="text-xs text-gray-500 mt-2">
                          {selectedFriends.size} friend{selectedFriends.size === 1 ? '' : 's'} selected
                        </p>
                      {/if}
                    {:else}
                      <div class="text-center py-4 bg-gray-50 rounded-md">
                        <p class="text-sm text-gray-500">
                          No friends yet. You can invite people after creating the group.
                        </p>
                      </div>
                    {/if}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              on:click={handleSubmit}
              disabled={isCreating || !groupName.trim()}
              class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {#if isCreating}
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
              {:else}
                Create Group
              {/if}
            </button>
            <button
              type="button"
              on:click={handleCancel}
              disabled={isCreating}
              class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}