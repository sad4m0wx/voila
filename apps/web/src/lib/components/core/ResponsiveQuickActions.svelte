<!-- Responsive Quick Actions - Replaces MobileQuickActions with responsive design -->
<script>
  import { goto } from '$app/navigation';
  
  export let recentGroups = [];
  export let isAuthenticated = false;
  
  async function handleAction(action) {
    goto(action);
  }
</script>

<div class="space-y-4 sm:space-y-6">
  <!-- Quick Actions -->
  <div>
    <h3 class="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Quick Actions</h3>
    <div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 gap-3 sm:gap-4">
      <button
        on:click={() => handleAction('/groups')}
        class="group p-3 sm:p-4 text-center bg-white hover:bg-gray-50 border border-gray-200 hover:border-blue-300 rounded-xl sm:rounded-2xl transition-all duration-200 hover:shadow-md"
      >
        <div class="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 group-hover:bg-blue-200 text-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-2 transition-colors">
          <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
          </svg>
        </div>
        <p class="font-semibold text-gray-900 text-xs sm:text-sm">Groups</p>
        <p class="text-xs text-gray-500 hidden sm:block">Plan together</p>
      </button>
      
      <button
        on:click={() => handleAction('/friends')}
        class="group p-3 sm:p-4 text-center bg-white hover:bg-gray-50 border border-gray-200 hover:border-green-300 rounded-xl sm:rounded-2xl transition-all duration-200 hover:shadow-md"
      >
        <div class="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 group-hover:bg-green-200 text-green-600 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-2 transition-colors">
          <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
          </svg>
        </div>
        <p class="font-semibold text-gray-900 text-xs sm:text-sm">Friends</p>
        <p class="text-xs text-gray-500 hidden sm:block">Add contacts</p>
      </button>
      
      <button
        on:click={() => handleAction('/addresses')}
        class="group p-3 sm:p-4 text-center bg-white hover:bg-gray-50 border border-gray-200 hover:border-purple-300 rounded-xl sm:rounded-2xl transition-all duration-200 hover:shadow-md"
      >
        <div class="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 group-hover:bg-purple-200 text-purple-600 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-2 transition-colors">
          <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
        </div>
        <p class="font-semibold text-gray-900 text-xs sm:text-sm">Places</p>
        <p class="text-xs text-gray-500 hidden sm:block">Saved spots</p>
      </button>
      
      <!-- Desktop-only fourth item -->
      <button
        on:click={() => handleAction('/profile')}
        class="hidden sm:block group p-3 sm:p-4 text-center bg-white hover:bg-gray-50 border border-gray-200 hover:border-indigo-300 rounded-xl sm:rounded-2xl transition-all duration-200 hover:shadow-md lg:hidden"
      >
        <div class="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-100 group-hover:bg-indigo-200 text-indigo-600 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-2 transition-colors">
          <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <p class="font-semibold text-gray-900 text-xs sm:text-sm">Profile</p>
        <p class="text-xs text-gray-500 hidden sm:block">Settings</p>
      </button>
    </div>
  </div>
  
  <!-- Recent Groups -->
  {#if isAuthenticated && recentGroups.length > 0}
    <div>
      <div class="flex items-center justify-between mb-3 sm:mb-4">
        <h3 class="text-base sm:text-lg font-semibold text-gray-900">Recent Groups</h3>
        <button 
          on:click={() => handleAction('/groups')}
          class="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          View All
        </button>
      </div>
      
      <div class="bg-white border border-gray-200 rounded-xl sm:rounded-2xl overflow-hidden shadow-sm">
        {#each recentGroups.slice(0, 3) as group, index}
          <button
            on:click={() => handleAction(`/groups/${group.id}`)}
            class="w-full flex items-center p-3 sm:p-4 text-left hover:bg-gray-50 transition-colors {index !== 0 ? 'border-t border-gray-100' : ''}"
          >
            <div class="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 text-blue-700 font-semibold rounded-lg sm:rounded-xl mr-3 flex items-center justify-center text-sm sm:text-base">
              {group.name ? group.name[0].toUpperCase() : 'G'}
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-medium text-gray-900 text-sm sm:text-base truncate">{group.name}</p>
              <p class="text-xs sm:text-sm text-gray-500">{group.members?.length || 0} members</p>
            </div>
            <svg class="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <h3 class="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Get Started</h3>
      <div class="bg-gradient-to-br from-blue-50 via-white to-purple-50 border border-blue-200 rounded-xl sm:rounded-2xl p-4 sm:p-6">
        <div class="flex items-start mb-3 sm:mb-4">
          <div class="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 text-blue-600 rounded-lg sm:rounded-xl flex items-center justify-center mr-3 flex-shrink-0">
            <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
          </div>
          <div class="flex-1">
            <h4 class="font-bold text-gray-900 text-sm sm:text-base">Join Voilà!</h4>
            <p class="text-xs sm:text-sm text-gray-600 mt-1">Save groups and favorite places</p>
          </div>
        </div>
        
        <div class="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <button
            on:click={() => handleAction('/auth/register')}
            class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl font-medium text-sm transition-colors"
          >
            Sign Up
          </button>
          <button
            on:click={() => handleAction('/auth/login')}
            class="flex-1 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl font-medium text-sm transition-colors"
          >
            Log In
          </button>
        </div>
      </div>
    </div>
  {/if}
</div> 