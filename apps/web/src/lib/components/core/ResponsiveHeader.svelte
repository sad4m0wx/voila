<!-- Responsive Header - Replaces MobileHeader with responsive design -->
<script>
  import { isAuthenticated, user } from "$stores/auth";

  export let title = "";
  export let showBackButton = false;
  export let showProfileButton = true;
  export let onBackClick = null;
  
  async function handleProfileClick() {
  }
  
  async function handleBackClick() {
    if (onBackClick) {
      onBackClick();
    } else {
      history.back();
    }
  }
</script>

<header class="bg-white border-b border-gray-200 sticky top-0 z-50 backdrop-blur-lg bg-white/95">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between h-14 sm:h-16">
      <!-- Left Side -->
      <div class="flex items-center">
        {#if showBackButton}
          <button
            on:click={handleBackClick}
            class="p-2 mr-2 sm:mr-3 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
            aria-label="Go back"
          >
            <svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
        {:else}
          <!-- App Logo/Icon -->
          <div class="flex items-center">
            <div class="relative">
              <div class="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-sm transform rotate-3">
                <span class="text-base sm:text-lg">📍</span>
              </div>
              <div class="absolute -top-0.5 -right-0.5 w-3 h-3 sm:w-4 sm:h-4 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-sm">
                <span class="text-xs">✨</span>
              </div>
            </div>
          </div>
        {/if}
        
        <!-- Title / Brand -->
        {#if title}
          <h1 class="ml-3 text-lg sm:text-xl font-bold text-gray-900">{title}</h1>
        {:else if !showBackButton}
          <div class="ml-3">
            <h1 class="text-lg sm:text-xl font-bold bg-gradient-to-r from-gray-800 via-blue-700 to-purple-700 bg-clip-text text-transparent">
              Voilà!
            </h1>
            <p class="text-xs sm:text-sm text-gray-500 font-medium -mt-0.5 hidden sm:block">
              Find perfect meeting spots
            </p>
          </div>
        {/if}
      </div>

      <!-- Right Side -->
      <div class="flex items-center space-x-2 sm:space-x-3">
        {#if $isAuthenticated && showProfileButton}
          <a 
            href="/profile" 
            class="p-1 hover:bg-gray-100 rounded-xl transition-colors"
            on:click={handleProfileClick}
            aria-label="View profile"
          >
            {#if $user?.photoURL}
              <img 
                src={$user.photoURL} 
                alt={$user.displayName || 'Profile'}
                class="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-white shadow-sm"
              />
            {:else}
              <div class="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-semibold rounded-full border-2 border-white shadow-sm">
                {#if $user?.displayName}
                  {$user.displayName.charAt(0).toUpperCase()}
                {:else if $user?.name}
                  {$user.name.charAt(0).toUpperCase()}
                {:else}
                  <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                {/if}
              </div>
            {/if}
          </a>
        {:else if !$isAuthenticated}
          <a 
            href="/auth/login" 
            class="px-3 py-2 sm:px-4 sm:py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
            on:click={handleProfileClick}
          >
            Login
          </a>
        {/if}
      </div>
    </div>
  </div>
</header> 