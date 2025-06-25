<!-- Mobile Quick Actions -->
<script>
  import { goto } from '$app/navigation';
  
  
  export let recentGroups = [];
  export let isAuthenticated = false;
  
  async function handleAction(action) {
    goto(action);
  }
</script>

<div class="space-y-4">
  <!-- Quick Actions -->
  <div>
    <h3 class="mobile-section-title mb-3">Quick Actions</h3>
    <div class="grid grid-cols-3 gap-3">
      <button
        on:click={() => handleAction('/groups')}
        class="mobile-card-pressed p-4 text-center"
      >
        <div class="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
          </svg>
        </div>
        <p class="font-semibold text-gray-900 text-sm">Groups</p>
        <p class="text-xs text-gray-500">Plan together</p>
      </button>
      
      <button
        on:click={() => handleAction('/friends')}
        class="mobile-card-pressed p-4 text-center"
      >
        <div class="w-12 h-12 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
          </svg>
        </div>
        <p class="font-semibold text-gray-900 text-sm">Friends</p>
        <p class="text-xs text-gray-500">Add contacts</p>
      </button>
      
      <button
        on:click={() => handleAction('/addresses')}
        class="mobile-card-pressed p-4 text-center"
      >
        <div class="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
          </svg>
        </div>
        <p class="font-semibold text-gray-900 text-sm">Places</p>
        <p class="text-xs text-gray-500">Saved spots</p>
      </button>
    </div>
  </div>
  
  <!-- Recent Groups -->
  {#if isAuthenticated && recentGroups.length > 0}
    <div>
      <div class="flex items-center justify-between mb-3">
        <h3 class="mobile-section-title">Recent Groups</h3>
        <button 
          on:click={() => handleAction('/groups')}
          class="mobile-btn-ghost text-sm"
        >
          View All
        </button>
      </div>
      
      <div class="mobile-list">
        {#each recentGroups.slice(0, 3) as group}
          <button
            on:click={() => handleAction(`/groups/${group.id}`)}
            class="mobile-list-item w-full text-left"
          >
            <div class="mobile-avatar mobile-avatar-sm bg-blue-100 text-blue-700 font-semibold mr-3 flex items-center justify-center">
              {group.name ? group.name[0].toUpperCase() : 'G'}
            </div>
            <div class="flex-1">
              <p class="font-medium text-gray-900">{group.name}</p>
              <p class="text-xs text-gray-500">{group.members?.length || 0} members</p>
            </div>
            <svg class="mobile-list-item-arrow w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        {/each}
      </div>
    </div>
  {/if}
  
  <!-- Auth CTA for non-authenticated users -->
  {#if !isAuthenticated}
    <div>
      <h3 class="mobile-section-title mb-3">Get Started</h3>
      <div class="mobile-card p-4 bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
        <div class="flex items-center mb-3">
          <div class="w-10 h-10 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mr-3">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
          </div>
          <div>
            <h4 class="font-bold text-gray-900">Join Voilà!</h4>
            <p class="text-sm text-gray-600">Save groups and favorite places</p>
          </div>
        </div>
        
        <div class="flex space-x-2">
          <button
            on:click={() => handleAction('/auth/register')}
            class="flex-1 mobile-btn-primary"
          >
            Sign Up
          </button>
          <button
            on:click={() => handleAction('/auth/login')}
            class="flex-1 mobile-btn-secondary"
          >
            Log In
          </button>
        </div>
      </div>
    </div>
  {/if}
</div> 