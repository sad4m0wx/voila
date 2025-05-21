<script>
  import { getContext } from "svelte";
  import MobileHeader from "$lib/components/mobile/MobileHeader.svelte";
  import MobileNavbar from "$lib/components/mobile/MobileNavbar.svelte";
  import AuthProvider from "$lib/components/auth/AuthProvider.svelte";
  
  import { loadFriends, friends } from "$stores/friends";
  import { groups } from "$stores/groups";
  import { logout } from "$stores/auth";

  // State
  const { user, profile, isLoading } = getContext('auth');
  const isMobile = getContext("isMobile");

  let isLoggingOut = false;
  let error = null;
  let showSignOutConfirm = false;

  if ($user && !$isLoading){
    loadFriends();
  };

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
    <!-- Header -->
    <MobileHeader title="Profile" showSettings={false} />

    <!-- Content area with header spacing -->
    <div class="flex-1 pt-[60px] pb-16 overflow-y-auto">
      {#if $isLoading}
        <div class="flex justify-center items-center h-full">
          <div
            class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"
          ></div>
        </div>
      {:else if $user}
        <div class="px-4 py-6">
          <!-- User Profile Card -->
          <div class="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
            <!-- Profile Header -->
            <div class="p-6 pb-4">
              <div class="flex items-center">
                {#if user.photoURL}
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "User"}
                    class="w-16 h-16 rounded-full object-cover"
                  />
                {:else}
                  <div
                    class="w-16 h-16 rounded-full bg-blue-500 text-white flex items-center justify-center text-xl font-bold"
                  >
                    {getUserInitials(user.displayName)}
                  </div>
                {/if}

                <div class="ml-4">
                  <h2 class="text-xl font-bold">
                    {user.displayName || "User"}
                    {#if user.isAnonymous}
                      <span
                        class="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full"
                      >
                        Guest
                      </span>
                    {/if}
                  </h2>
                  {#if user.email}
                    <p class="text-gray-500 text-sm">{user.email}</p>
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
            </div>
          </div>

          {#if error}
            <div
              class="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm"
            >
              {error}
            </div>
          {/if}

          {#if user.isAnonymous}
            <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
              <div class="flex">
                <div class="flex-shrink-0">
                  <svg
                    class="h-5 w-5 text-yellow-400"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </div>
                <div class="ml-3">
                  <p class="text-sm text-yellow-700">
                    You're using a guest account. Your data will be lost when
                    you sign out.
                  </p>
                  <div class="mt-2">
                    <a
                      href="/auth/register"
                      class="px-4 py-2 bg-yellow-700 text-white text-sm rounded-md inline-block font-medium"
                    >
                      Create Full Account
                    </a>
                  </div>
                </div>
              </div>
            </div>
          {/if}

          <!-- Settings List -->
          <div class="space-y-4">
            <div class="bg-white rounded-xl overflow-hidden shadow-sm">
              <a
                href="/saved-addresses"
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

              <div class="border-t border-gray-100"></div>

              <a
                href="/notifications"
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
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
                      ></path>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                  </div>
                  <span class="ml-3 font-medium">Notifications</span>
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

              <div class="border-t border-gray-100"></div>

              <a
                href="/privacy"
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
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"
                      ></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </div>
                  <span class="ml-3 font-medium">Privacy Settings</span>
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

              <div class="border-t border-gray-100"></div>

              <a
                href="/help"
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
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                      <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                  </div>
                  <span class="ml-3 font-medium">Help & Support</span>
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

            <!-- Sign Out Button -->
            <button
              class="w-full py-3 text-red-600 font-medium border border-red-200 rounded-xl"
              on:click={() => (showSignOutConfirm = true)}
            >
              Sign Out
            </button>
          </div>
        </div>
      {/if}
    </div>

    <!-- Bottom Navigation -->
    <MobileNavbar />

    <!-- Confirmation Modal -->
    {#if showSignOutConfirm}
      <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      >
        <div class="bg-white rounded-xl p-5 w-full max-w-xs">
          <h3 class="text-lg font-bold mb-2">Sign Out?</h3>
          <p class="text-gray-600 mb-5 text-sm">
            {#if user?.isAnonymous}
              Warning: You're using a guest account. All your data will be lost
              if you sign out.
            {:else}
              Are you sure you want to sign out of your account?
            {/if}
          </p>

          <div class="flex space-x-3">
            <button
              class="flex-1 py-2 bg-gray-100 text-gray-800 font-medium rounded-lg"
              on:click={cancelLogout}
            >
              Cancel
            </button>
            <button
              class="flex-1 py-2 bg-red-600 text-white font-medium rounded-lg"
              on:click={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? "Signing out..." : "Sign Out"}
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
{:else}
  <!-- Desktop view -->
  <div class="container mx-auto px-4 py-8">
    <!-- Desktop profile page content -->

    <div class="container mx-auto px-4 py-8">
      {#if $isLoading}
        <div class="flex justify-center items-center py-12">
          <div class="loader"></div>
        </div>
      {:else if user}
        <div class="max-w-4xl mx-auto">
          <div class="card p-6 shadow-md mb-8">
            <div
              class="flex flex-col md:flex-row items-center md:items-start gap-6"
            >
              <div
                class="w-24 h-24 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-2xl font-bold"
              >
                {#if user.photoURL}
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "User"}
                    class="w-full h-full object-cover rounded-full"
                  />
                {:else}
                  {getUserInitials(user.displayName)}
                {/if}
              </div>

              <div class="flex-1 text-center md:text-left">
                <h1 class="text-2xl font-bold mb-1">
                  {user.displayName || "User"}
                </h1>
                <p class="text-neutral-600 mb-4">{user.email}</p>

                <div
                  class="flex flex-wrap gap-3 justify-center md:justify-start"
                >
                  {#if user.isAnonymous}
                    <div class="badge bg-warning bg-opacity-10 text-warning">
                      Guest Account
                    </div>
                  {/if}

                  <div class="badge bg-neutral-100 text-neutral-700">
                    {$friends.length}
                    {$friends.length === 1 ? "Friend" : "Friends"}
                  </div>

                  <div class="badge bg-neutral-100 text-neutral-700">
                    {$groups.length}
                    {$groups.length === 1 ? "Group" : "Groups"}
                  </div>
                </div>
              </div>

              <div>
                <button
                  class="btn btn-outline text-neutral-700"
                  on:click={handleLogout}
                  disabled={isLoggingOut}
                >
                  {#if isLoggingOut}
                    <span class="loader loader-sm mr-2"></span>
                    <span>Signing Out...</span>
                  {:else}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-5 w-5 mr-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    <span>Sign Out</span>
                  {/if}
                </button>
              </div>
            </div>

            {#if error}
              <div class="alert alert-error mt-6">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="alert-icon"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fill-rule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clip-rule="evenodd"
                  />
                </svg>
                <span>{error}</span>
              </div>
            {/if}

            {#if user.isAnonymous}
              <div
                class="mt-6 p-4 bg-warning bg-opacity-10 rounded-md border-l-4 border-warning"
              >
                <h3 class="font-semibold text-warning-700 mb-2">
                  Guest Account
                </h3>
                <p class="text-neutral-700 mb-4">
                  You're using a temporary guest account. Your data will be lost
                  when you sign out.
                </p>
                <a href="/auth/register" class="btn btn-warning"
                  >Upgrade to Full Account</a
                >
              </div>
            {/if}
          </div>

          <div class="grid md:grid-cols-2 gap-6">
            <!-- Groups Section -->
            <div class="card p-6 shadow-md">
              <div class="flex justify-between items-center mb-6">
                <h2 class="text-xl font-bold">My Groups</h2>
                <a href="/groups/create" class="btn btn-sm btn-primary">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4 mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Create
                </a>
              </div>

              {#if $groups.length === 0}
                <div class="text-center py-8 text-neutral-500">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-12 w-12 mx-auto mb-3 text-neutral-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  <p>You don't have any groups yet</p>
                  <a href="/groups/create" class="btn btn-sm btn-primary mt-3"
                    >Create a Group</a
                  >
                </div>
              {:else}
                <ul class="space-y-3">
                  {#each $groups as group}
                    <li
                      class="flex justify-between items-center p-3 bg-bg-subtle rounded-md hover:bg-primary-50 transition-colors"
                    >
                      <div>
                        <a
                          href={`/groups/${group.id}`}
                          class="font-medium text-primary-700 hover:text-primary-800"
                        >
                          {group.name}
                        </a>
                        <p class="text-sm text-neutral-500">
                          {group.members?.length || 0}
                          {group.members?.length === 1 ? "member" : "members"}
                        </p>
                      </div>
                      <a
                        href={`/groups/${group.id}`}
                        class="text-neutral-400 hover:text-primary-600"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </a>
                    </li>
                  {/each}
                </ul>

                <a
                  href="/groups"
                  class="block text-center text-primary-600 hover:text-primary-700 mt-4 font-medium"
                >
                  View All Groups
                </a>
              {/if}
            </div>

            <!-- Friends Section -->
            <div class="card p-6 shadow-md">
              <div class="flex justify-between items-center mb-6">
                <h2 class="text-xl font-bold">My Friends</h2>
                <a href="/friends" class="btn btn-sm btn-primary">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4 mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add
                </a>
              </div>

              {#if $friends.length === 0}
                <div class="text-center py-8 text-neutral-500">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-12 w-12 mx-auto mb-3 text-neutral-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                  <p>You don't have any friends yet</p>
                  <a href="/friends" class="btn btn-sm btn-primary mt-3"
                    >Add Friends</a
                  >
                </div>
              {:else}
                <ul class="space-y-3">
                  {#each $friends as friend}
                    <li
                      class="flex items-center p-3 bg-bg-subtle rounded-md hover:bg-primary-50 transition-colors"
                    >
                      <div
                        class="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold mr-3"
                      >
                        {#if friend.photoURL}
                          <img
                            src={friend.photoURL}
                            alt={friend.displayName}
                            class="w-full h-full object-cover rounded-full"
                          />
                        {:else}
                          {getUserInitials(friend.displayName)}
                        {/if}
                      </div>
                      <div>
                        <a
                          href={`/user/${friend.id}`}
                          class="font-medium text-primary-700 hover:text-primary-800"
                        >
                          {friend.displayName}
                        </a>
                      </div>
                    </li>
                  {/each}
                </ul>

                <a
                  href="/friends"
                  class="block text-center text-primary-600 hover:text-primary-700 mt-4 font-medium"
                >
                  View All Friends
                </a>
              {/if}
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
</AuthProvider>