<!-- src/routes/profile/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { isAuthenticated, isLoading, authStore, logout } from '$stores/auth';
  import { loadFriends, friends } from '$stores/friends';
  import { loadUserGroups, groups } from '$stores/groups';
  
  let isLogoutLoading = false;
  let error = null;
  
  onMount(() => {
    // Redirect if not authenticated after loading completes
    const unwatch = isAuthenticated.subscribe(value => {
      if (!$isLoading && !value) {
        window.location.href = '/login?redirect=/profile';
      }
    });
    
    // Load user data
    if ($isAuthenticated) {
      loadFriends();
      loadUserGroups();
    }
    
    return unwatch;
  });
  
  // Handle logout
  async function handleLogout() {
    isLogoutLoading = true;
    error = null;
    
    try {
      await logout();
      goto('/');
    } catch (err) {
      error = err.message;
      isLogoutLoading = false;
    }
  }
  
  function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(part => part[0]).join('').toUpperCase();
  }
</script>

<svelte:head>
  <title>My Profile | Voilà!</title>
  <meta name="description" content="Manage your Voilà profile" />
</svelte:head>

<div class="container mx-auto px-4 py-8">
  {#if $isLoading}
    <div class="flex justify-center items-center py-12">
      <div class="loader"></div>
    </div>
  {:else if $authStore.user}
    <div class="max-w-4xl mx-auto">
      <div class="card p-6 shadow-md mb-8">
        <div class="flex flex-col md:flex-row items-center md:items-start gap-6">
          <div class="w-24 h-24 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-2xl font-bold">
            {#if $authStore.user.photoURL}
              <img src={$authStore.user.photoURL} alt={$authStore.user.displayName || 'User'} class="w-full h-full object-cover rounded-full" />
            {:else}
              {getInitials($authStore.user.displayName)}
            {/if}
          </div>
          
          <div class="flex-1 text-center md:text-left">
            <h1 class="text-2xl font-bold mb-1">{$authStore.user.displayName || 'User'}</h1>
            <p class="text-neutral-600 mb-4">{$authStore.user.email}</p>
            
            <div class="flex flex-wrap gap-3 justify-center md:justify-start">
              {#if $authStore.user.isAnonymous}
                <div class="badge bg-warning bg-opacity-10 text-warning">
                  Guest Account
                </div>
              {/if}
              
              <div class="badge bg-neutral-100 text-neutral-700">
                {$friends.length} {$friends.length === 1 ? 'Friend' : 'Friends'}
              </div>
              
              <div class="badge bg-neutral-100 text-neutral-700">
                {$groups.length} {$groups.length === 1 ? 'Group' : 'Groups'}
              </div>
            </div>
          </div>
          
          <div>
            <button 
              class="btn btn-outline text-neutral-700" 
              on:click={handleLogout}
              disabled={isLogoutLoading}
            >
              {#if isLogoutLoading}
                <span class="loader loader-sm mr-2"></span>
                <span>Signing Out...</span>
              {:else}
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Sign Out</span>
              {/if}
            </button>
          </div>
        </div>
        
        {#if error}
          <div class="alert alert-error mt-6">
            <svg xmlns="http://www.w3.org/2000/svg" class="alert-icon" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        {/if}
        
        {#if $authStore.user.isAnonymous}
          <div class="mt-6 p-4 bg-warning bg-opacity-10 rounded-md border-l-4 border-warning">
            <h3 class="font-semibold text-warning-700 mb-2">Guest Account</h3>
            <p class="text-neutral-700 mb-4">You're using a temporary guest account. Your data will be lost when you sign out.</p>
            <a href="/register" class="btn btn-warning">Upgrade to Full Account</a>
          </div>
        {/if}
      </div>
      
      <div class="grid md:grid-cols-2 gap-6">
        <!-- Groups Section -->
        <div class="card p-6 shadow-md">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-bold">My Groups</h2>
            <a href="/groups/create" class="btn btn-sm btn-primary">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Create
            </a>
          </div>
          
          {#if $groups.length === 0}
            <div class="text-center py-8 text-neutral-500">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-3 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p>You don't have any groups yet</p>
              <a href="/groups/create" class="btn btn-sm btn-primary mt-3">Create a Group</a>
            </div>
          {:else}
            <ul class="space-y-3">
              {#each $groups as group}
                <li class="flex justify-between items-center p-3 bg-bg-subtle rounded-md hover:bg-primary-50 transition-colors">
                  <div>
                    <a href={`/groups/${group.id}`} class="font-medium text-primary-700 hover:text-primary-800">
                      {group.name}
                    </a>
                    <p class="text-sm text-neutral-500">
                      {group.members?.length || 0} {group.members?.length === 1 ? 'member' : 'members'}
                    </p>
                  </div>
                  <a href={`/groups/${group.id}`} class="text-neutral-400 hover:text-primary-600">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                </li>
              {/each}
            </ul>
            
            <a href="/groups" class="block text-center text-primary-600 hover:text-primary-700 mt-4 font-medium">
              View All Groups
            </a>
          {/if}
        </div>
        
        <!-- Friends Section -->
        <div class="card p-6 shadow-md">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-bold">My Friends</h2>
            <a href="/friends" class="btn btn-sm btn-primary">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Add
            </a>
          </div>
          
          {#if $friends.length === 0}
            <div class="text-center py-8 text-neutral-500">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-3 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <p>You don't have any friends yet</p>
              <a href="/friends" class="btn btn-sm btn-primary mt-3">Add Friends</a>
            </div>
          {:else}
            <ul class="space-y-3">
              {#each $friends as friend}
                <li class="flex items-center p-3 bg-bg-subtle rounded-md hover:bg-primary-50 transition-colors">
                  <div class="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold mr-3">
                    {#if friend.photoURL}
                      <img src={friend.photoURL} alt={friend.displayName} class="w-full h-full object-cover rounded-full" />
                    {:else}
                      {getInitials(friend.displayName)}
                    {/if}
                  </div>
                  <div>
                    <a href={`/user/${friend.id}`} class="font-medium text-primary-700 hover:text-primary-800">
                      {friend.displayName}
                    </a>
                  </div>
                </li>
              {/each}
            </ul>
            
            <a href="/friends" class="block text-center text-primary-600 hover:text-primary-700 mt-4 font-medium">
              View All Friends
            </a>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>