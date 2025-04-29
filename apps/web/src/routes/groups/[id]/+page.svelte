<!-- src/routes/groups/[id]/+page.svelte -->
<script>
  import Navbar from "$lib/components/Navbar.svelte";
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import AuthProvider from "$lib/components/auth/AuthProvider.svelte";
  
  const { user, profile, isLoading } = getContext('auth');

  // Group data
  let group = null;
  let members = [];
  let error = null;
  
  // Group settings
  let showSettingsModal = false;
  let editName = "";
  let editDescription = "";
  
  // Meeting calculator
  let addresses = [];
  let meetingPoint = null;
  let isCalculating = false;
  let calculationError = null;
  
  onMount(async () => {
    
    const groupId = $page.params.id;
    
    try {
      // Simulate API calls
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock group data based on the ID
      group = {
        id: parseInt(groupId),
        name: ["College Friends", "Work Team", "Family"][parseInt(groupId) % 3],
        description: ["Friends from university", "Colleagues from work", "Family members"][parseInt(groupId) % 3],
        createdAt: new Date(2023, 5, 15),
        creatorId: "user123"
      };
      
      // Mock members data
      members = [
        { id: "user123", name: "You", email: "you@example.com", avatar: null, isCreator: true, isAdmin: true },
        { id: "user1", name: "Jane Smith", email: "jane@example.com", avatar: null, isAdmin: false },
        { id: "user2", name: "John Doe", email: "john@example.com", avatar: null, isAdmin: true },
        { id: "user3", name: "Alice Johnson", email: "alice@example.com", avatar: null, isAdmin: false }
      ];
      
      // Prepare addresses from members for the meeting calculator
      addresses = members.map(member => ({
        id: member.id,
        value: `${member.name}'s Location`,
        selected: member.id === "user123" // Select current user by default
      }));
      
      editName = group.name;
      editDescription = group.description;
    } catch (err) {
      error = "Failed to load group data";
      console.error(err);
    } 
  });
  
  // Calculate optimal meeting point
  async function findMeetingPoint() {
    // Get selected addresses
    const selectedAddresses = addresses.filter(addr => addr.selected);
    
    if (selectedAddresses.length < 2) {
      calculationError = "Please select at least 2 members";
      return;
    }
    
    calculationError = null;
    isCalculating = true;
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock result
      meetingPoint = {
        name: "Optimal Meeting Point",
        coordinates: [2.3522, 48.8566], // Paris
        travelTimes: selectedAddresses.map(addr => {
          const member = members.find(m => m.id === addr.id);
          return {
            id: addr.id,
            name: member ? member.name : "Unknown",
            duration: Math.floor(Math.random() * 30) + 10, // Random time between 10-40 min
            distance: Math.floor(Math.random() * 5000) + 1000, // Random distance
            transitSummary: Math.random() > 0.5 ? "🚇 Metro Line 4" : "🚶 Walking",
          };
        })
      };
    } catch (err) {
      calculationError = err.message || "Failed to calculate meeting point";
    } finally {
      isCalculating = false;
    }
  }
  
  // Toggle member selection for meeting point calculation
  function toggleMemberSelection(memberId) {
    addresses = addresses.map(addr => 
      addr.id === memberId ? { ...addr, selected: !addr.selected } : addr
    );
  }
  
  // Update group settings
  async function saveGroupSettings() {
    try {
      if (!editName.trim()) {
        throw new Error("Group name is required");
      }
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Update group data
      group = {
        ...group,
        name: editName,
        description: editDescription
      };
      
      showSettingsModal = false;
    } catch (err) {
      error = err.message || "Failed to update group settings";
    }
  }
  
  // Format date
  function formatDate(date) {
    if (!date) return '';
    
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(date).toLocaleDateString(undefined, options);
  }
</script>

<svelte:head>
  <title>{group ? group.name : 'Group'} | Voilà!</title>
</svelte:head>

<Navbar />

<AuthProvider requireAuth={true}>
<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  {#if isLoading}
    <div class="flex justify-center items-center h-64">
      <svg class="animate-spin h-10 w-10 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>
  {:else if group}
    {#if error}
      <div class="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <p class="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    {/if}
    
    <!-- Group Header -->
    <div class="bg-white shadow rounded-lg p-6 mb-8">
      <div class="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">{group.name}</h1>
          {#if group.description}
            <p class="mt-1 text-sm text-gray-500">{group.description}</p>
          {/if}
          <p class="mt-2 text-xs text-gray-500">Created {formatDate(group.createdAt)}</p>
        </div>
        <div class="mt-5 sm:mt-0 flex space-x-3">
          <button 
            type="button" 
            class="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            on:click={() => showSettingsModal = true}
          >
            <svg class="-ml-1 mr-2 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
            </svg>
            Settings
          </button>
          <button 
            type="button" 
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <svg class="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
            </svg>
            Invite Member
          </button>
        </div>
      </div>
    </div>
    
    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <!-- Meeting Point Calculator -->
      <div class="bg-white shadow rounded-lg p-6">
        <h2 class="text-xl font-semibold text-gray-900 mb-4">Find Meeting Point</h2>
        
        {#if calculationError}
          <div class="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-red-700">{calculationError}</p>
              </div>
            </div>
          </div>
        {/if}
        
        <div class="mb-4">
          <h3 class="text-sm font-medium text-gray-700 mb-2">Select who's attending:</h3>
          <div class="space-y-2 max-h-60 overflow-y-auto">
            {#each addresses as address (address.id)}
              <div 
                class="flex items-center p-2 rounded-md hover:bg-gray-50 cursor-pointer {address.selected ? 'bg-primary-50 border border-primary-200' : 'border border-gray-200'}"
                on:click={() => toggleMemberSelection(address.id)}
              >
                <input
                  type="checkbox"
                  class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={address.selected}
                  on:change={() => toggleMemberSelection(address.id)}
                />
                <div class="ml-3">
                  <p class="text-sm font-medium text-gray-900">{address.value}</p>
                </div>
              </div>
            {/each}
          </div>
        </div>
        
        <div class="mt-5">
          <button 
            type="button" 
            class="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            on:click={findMeetingPoint}
            disabled={isCalculating}
          >
            {#if isCalculating}
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Calculating...
            {:else}
              <svg class="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M12 1.586l-4 4v12.828l4-4V1.586zM3.707 3.293A1 1 0 002 4v10a1 1 0 00.293.707L6 18.414V5.586L3.707 3.293zM17.707 5.293L14 1.586v12.828l2.293 2.293A1 1 0 0018 16V6a1 1 0 00-.293-.707z" clip-rule="evenodd" />
              </svg>
              Calculate Meeting Point
            {/if}
          </button>
        </div>
        
        {#if meetingPoint}
          <div class="mt-6 border-t border-gray-200 pt-4">
            <h3 class="text-lg font-medium text-gray-900 mb-3">Optimal Meeting Point</h3>
            
            <div class="bg-gray-50 p-4 rounded-lg mb-4">
              <div class="flex items-center">
                <div class="flex-shrink-0 bg-primary-100 rounded-md p-2">
                  <svg class="h-6 w-6 text-primary-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div class="ml-4">
                  <h4 class="text-lg font-medium">{meetingPoint.name}</h4>
                  <p class="text-sm text-gray-500">Located at coordinates: [{meetingPoint.coordinates[0].toFixed(4)}, {meetingPoint.coordinates[1].toFixed(4)}]</p>
                </div>
              </div>
            </div>
            
            <h4 class="font-medium text-gray-700 mb-2">Travel Times</h4>
            <ul class="divide-y divide-gray-200">
              {#each meetingPoint.travelTimes as time (time.id)}
                <li class="py-3">
                  <div class="flex justify-between">
                    <div>
                      <p class="text-sm font-medium text-gray-900">{time.name}</p>
                      <p class="text-sm text-gray-500">{time.transitSummary}</p>
                    </div>
                    <div class="bg-gray-100 px-2 py-1 rounded text-sm font-medium">
                      {time.duration} min
                    </div>
                  </div>
                </li>
              {/each}
            </ul>
            
            <div class="mt-6 flex justify-center">
              <a 
                href="https://www.google.com/maps/search/?api=1&query={meetingPoint.coordinates[1]},{meetingPoint.coordinates[0]}" 
                target="_blank" 
                rel="noopener noreferrer"
                class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <svg class="-ml-1 mr-2 h-5 w-5 text-primary-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M12 1.586l-4 4v12.828l4-4V1.586zM3.707 3.293A1 1 0 002 4v10a1 1 0 00.293.707L6 18.414V5.586L3.707 3.293zM17.707 5.293L14 1.586v12.828l2.293 2.293A1 1 0 0018 16V6a1 1 0 00-.293-.707z" clip-rule="evenodd" />
                </svg>
                Open in Google Maps
              </a>
            </div>
          </div>
        {/if}
      </div>
      
      <!-- Members List -->
      <div class="bg-white shadow rounded-lg p-6">
        <h2 class="text-xl font-semibold text-gray-900 mb-4">Members ({members.length})</h2>
        
        <ul class="divide-y divide-gray-200">
          {#each members as member (member.id)}
            <li class="py-4 flex justify-between">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  {#if member.avatar}
                    <img class="h-10 w-10 rounded-full" src={member.avatar} alt={member.name} />
                  {:else}
                    <div class="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium">
                      {member.name[0].toUpperCase()}
                    </div>
                  {/if}
                </div>
                <div class="ml-3">
                  <p class="text-sm font-medium text-gray-900">
                    {member.name}
                    {#if member.id === "user123"}
                      <span class="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                        You
                      </span>
                    {/if}
                  </p>
                  {#if member.isCreator}
                    <p class="text-xs font-medium text-primary-600">Owner</p>
                  {:else if member.isAdmin}
                    <p class="text-xs font-medium text-primary-600">Admin</p>
                  {/if}
                </div>
              </div>
              {#if member.id !== "user123"}
                <div class="ml-2">
                  <button 
                    type="button" 
                    class="inline-flex items-center p-1 border border-transparent rounded-full shadow-sm text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    </div>
    
    <!-- Group Settings Modal -->
    {#if showSettingsModal}
      <div class="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <!-- Background overlay -->
          <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" on:click={() => showSettingsModal = false}></div>
          
          <!-- Modal panel -->
          <div class="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
            <div>
              <div class="mt-3 text-center sm:mt-0 sm:text-left">
                <h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                  Group Settings
                </h3>
                <div class="mt-4">
                  <div class="space-y-4">
                    <div>
                      <label for="group-name" class="block text-sm font-medium text-gray-700">
                        Group Name *
                      </label>
                      <div class="mt-1">
                        <input 
                          type="text" 
                          name="group-name" 
                          id="group-name" 
                          class="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          placeholder="Enter group name"
                          bind:value={editName}
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label for="group-description" class="block text-sm font-medium text-gray-700">
                        Description (optional)
                      </label>
                      <div class="mt-1">
                        <textarea 
                          id="group-description" 
                          name="group-description" 
                          rows="3" 
                          class="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          placeholder="What's this group about?"
                          bind:value={editDescription}
                        ></textarea>
                      </div>
                    </div>
                    
                    <div class="pt-3 border-t border-gray-200">
                      <h4 class="text-sm font-medium text-red-700">Danger Zone</h4>
                      <div class="mt-2">
                        <button 
                          type="button" 
                          class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          <svg class="-ml-0.5 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                          </svg>
                          Delete Group
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
              <button 
                type="button" 
                class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:col-start-2 sm:text-sm"
                on:click={saveGroupSettings}
              >
                Save Changes
              </button>
              <button 
                type="button" 
                class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                on:click={() => showSettingsModal = false}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</main>
</AuthProvider>