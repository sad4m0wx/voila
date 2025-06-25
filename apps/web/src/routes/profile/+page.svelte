<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import ResponsiveNavigation from "$components/core/ResponsiveNavigation.svelte";
  import AuthProvider from "$components/auth/AuthProvider.svelte";
  
  import { loadFriends, friends } from "$stores/friends";
  import { loadUserGroups, groups } from "$stores/groups";
  import { authStore, logout, isLoading as authLoading } from "$stores/auth";
  import { getUserProfile, updateUserProfile } from "$lib/firebase-auth/users";
  import { getFirestore } from "firebase/firestore";

  // State
  let isLoggingOut = false;
  let error = null;
  let showSignOutConfirm = false;
  let profile = null;
  let isProfileLoading = false;
  let isMobile = true; // Default to mobile view for now

  onMount(async () => {
    if ($authStore.user && !$authLoading) {
      try {
        await loadFriends();
        await loadUserGroups();
        await loadUserProfile();
      } catch (err) {
        error = err.message;
      }
    }
  });

  // Load user profile from Firestore
  async function loadUserProfile() {
    if (!$authStore.user) return;
    
    isProfileLoading = true;
    try {
      const db = getFirestore();
      profile = await getUserProfile(db, $authStore.user.uid);
      isProfileLoading = false;
    } catch (err) {
      console.error("Error loading profile:", err);
      error = err.message;
      isProfileLoading = false;
    }
  }

  // Handle logout
  async function handleLogout() {
    isLoggingOut = true;
    error = null;

    try {
      await logout();
      goto("/");
    } catch (err) {
      error = err.message;
      isLoggingOut = false;
    }
  }

  // Toggle sign out confirmation
  function toggleSignOutConfirm() {
    showSignOutConfirm = !showSignOutConfirm;
  }

  // Cancel logout
  function cancelLogout() {
    showSignOutConfirm = false;
  }

  // Get user initials
  function getUserInitials(name) {
    if (!name) return "?";

    const words = name.split(" ");
    if (words.length === 1) {
      return name.substring(0, 1).toUpperCase();
    }

    return (words[0][0] + words[1][0]).toUpperCase();
  }
</script>

<svelte:head>
  <title>Profile | Voilà!</title>
</svelte:head>

<AuthProvider requireAuth={true}>
{#if isMobile}
  <!-- Mobile Layout -->
  <div class="flex flex-col h-screen bg-white">
    <!-- Content area with header spacing -->
    <div class="flex-1 pt-[60px] pb-16 overflow-y-auto">
      {#if $authLoading || isProfileLoading}
        <div class="flex justify-center items-center h-full">
          <div
            class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"
          ></div>
        </div>
      {:else if $authStore.user}
        <div class="px-4 py-6">
          <!-- User Profile Card -->
          <div class="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
            <!-- Profile Header -->
            <div class="p-6 pb-4">
              <div class="flex items-center">
                {#if $authStore.user.photoURL}
                  <img
                    src={$authStore.user.photoURL}
                    alt={$authStore.user.displayName || "User"}
                    class="w-16 h-16 rounded-full object-cover"
                  />
                {:else}
                  <div
                    class="w-16 h-16 rounded-full bg-blue-500 text-white flex items-center justify-center text-xl font-bold"
                  >
                    {getUserInitials($authStore.user.displayName)}
                  </div>
                {/if}

                <div class="ml-4">
                  <h2 class="text-xl font-bold">
                    {$authStore.user.displayName || "User"}
                  </h2>
                  {#if $authStore.user.email}
                    <p class="text-gray-500 text-sm">{$authStore.user.email}</p>
                  {/if}
                </div>
              </div>
            </div>

            <!-- Stats -->
            <div
              class="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100"
            >
              <div class="p-4 text-center">
                <p class="text-2xl font-semibold">{$friends.length}</p>
                <p class="text-xs text-gray-500">Friends</p>
              </div>
              <div class="p-4 text-center">
                <p class="text-2xl font-semibold">{$groups.length}</p>
                <p class="text-xs text-gray-500">Groups</p>
              </div>
              <div class="p-4 text-center">
                <p class="text-2xl font-semibold">{profile?.savedAddresses?.length || 0}</p>
                <p class="text-xs text-gray-500">Addresses</p>
              </div>
            </div>
          </div>

          {#if error}
            <div
              class="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm"
            >
              {error}
            </div>
          {/if}

          <!-- Settings List -->
          <div class="space-y-4">
            <!-- Saved Addresses -->
            <div class="bg-white rounded-xl overflow-hidden shadow-sm">
              <a
                href="/addresses"
                class="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div class="flex items-center">
                  <div
                    class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-500"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"
                      ></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                  </div>
                  <span class="ml-3 font-medium">Saved Addresses</span>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5 text-gray-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clip-rule="evenodd"
                  />
                </svg>
              </a>
            </div>

            <!-- Friends -->
            <div class="bg-white rounded-xl overflow-hidden shadow-sm">
              <a
                href="/friends"
                class="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div class="flex items-center">
                  <div
                    class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-500"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                  </div>
                  <span class="ml-3 font-medium">Friends</span>
                </div>
                <div class="flex items-center">
                  {#if $friends.length > 0}
                    <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full mr-2">
                      {$friends.length}
                    </span>
                  {/if}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5 text-gray-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </div>
              </a>
            </div>

            <!-- Groups -->
            <div class="bg-white rounded-xl overflow-hidden shadow-sm">
              <a
                href="/groups"
                class="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div class="flex items-center">
                  <div
                    class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-500"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
                    </svg>
                  </div>
                  <span class="ml-3 font-medium">Groups</span>
                </div>
                <div class="flex items-center">
                  {#if $groups.length > 0}
                    <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full mr-2">
                      {$groups.length}
                    </span>
                  {/if}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5 text-gray-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </div>
              </a>
            </div>

            <!-- Settings -->
            <div class="bg-white rounded-xl overflow-hidden shadow-sm">
              <a
                href="/settings"
                class="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div class="flex items-center">
                  <div
                    class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-500"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <circle cx="12" cy="12" r="3"></circle>
                      <path
                        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
                      ></path>
                    </svg>
                  </div>
                  <span class="ml-3 font-medium">Settings</span>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5 text-gray-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clip-rule="evenodd"
                  />
                </svg>
              </a>
            </div>

            <!-- Sign Out -->
            <button
              on:click={toggleSignOutConfirm}
              class="w-full bg-white rounded-xl shadow-sm overflow-hidden mt-4"
            >
              <div class="flex items-center justify-between p-4 text-red-500">
                <div class="flex items-center">
                  <div
                    class="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
                      ></path>
                      <polyline points="16 17 21 12 16 7"></polyline>
                      <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                  </div>
                  <span class="ml-3 font-medium">Sign Out</span>
                </div>
              </div>
            </button>
          </div>
        </div>
      {/if}
    </div>

    <!-- Mobile Bottom Nav -->
    <ResponsiveNavigation />
  </div>
{:else}
  <!-- Desktop Layout (to be implemented) -->
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-2xl font-bold mb-6">Profile</h1>
    <p>Desktop profile view is not yet implemented.</p>
  </div>
{/if}

<!-- Sign Out Confirmation Modal -->
{#if showSignOutConfirm}
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
  >
    <div class="bg-white rounded-lg max-w-sm w-full mx-4 p-6">
      <h3 class="text-lg font-medium text-center mb-4">
        Are you sure you want to sign out?
      </h3>
      <div class="flex space-x-3 mt-6">
        <button
          on:click={cancelLogout}
          class="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 font-medium"
        >
          Cancel
        </button>
        <button
          on:click={handleLogout}
          class="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium"
        >
          {#if isLoggingOut}
            <svg
              class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Signing Out...
          {:else}
            Sign Out
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
</AuthProvider>