<!-- apps/web/src/routes/groups/[id]/invite/+page.svelte -->
<script>
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import AuthProvider from '$lib/components/auth/AuthProvider.svelte';
    import { isAuthenticated, isLoading as authLoading } from '$lib/stores/auth';
    import { loadGroup, currentGroup, isLoading } from '$lib/stores/groups';
    import InviteUser from '$lib/components/groups/InviteUser.svelte';
    
    // Get group ID from URL parameter
    const groupId = $page.params.id;
    
    onMount(() => {
      // Redirect if not authenticated after loading completes
      const unsubscribe = isAuthenticated.subscribe(value => {
        if (!$authLoading && !value) {
          window.location.href = `/auth/login?redirect=/groups/${groupId}/invite`;
        }
      });
      
      // Load the group
      loadGroup(groupId);
      
      return unsubscribe;
    });
  </script>
  
  <svelte:head>
    <title>Invite to {$currentGroup ? $currentGroup.name : 'Group'} | Voilà!</title>
    <meta name="description" content="Invite people to your group on Voilà" />
  </svelte:head>
  
  <AuthProvider>
    <div class="invite-page">
      {#if $isLoading}
        <div class="loading-state">
          <div class="loader"></div>
          <p>Loading group...</p>
        </div>
      {:else if $currentGroup}
        <div class="invite-content">
          <InviteUser {groupId} />
        </div>
      {:else}
        <div class="not-found">
          <svg xmlns="http://www.w3.org/2000/svg" class="not-found-icon" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h2>Group Not Found</h2>
          <p>The group you're looking for doesn't exist or you don't have access to it.</p>
          <button class="btn btn-primary" on:click={() => goto('/groups')}>Go to My Groups</button>
        </div>
      {/if}
    </div>
  </AuthProvider>
  
  <style>
    .invite-page {
      max-width: 800px;
      margin: 0 auto;
      padding: var(--space-4);
    }
    
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 300px;
      text-align: center;
      color: var(--text-secondary);
    }
    
    .invite-content {
      background-color: var(--bg-card);
      border-radius: var(--radius-lg);
      padding: var(--space-6);
      box-shadow: var(--shadow-md);
    }
    
    .not-found {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: var(--space-8) 0;
    }
    
    .not-found-icon {
      margin-bottom: var(--space-4);
      color: var(--error);
    }
    
    .not-found h2 {
      margin-bottom: var(--space-2);
      color: var(--text-primary);
    }
    
    .not-found p {
      margin-bottom: var(--space-6);
      color: var(--text-secondary);
    }
    
    @media (max-width: 768px) {
      .invite-content {
        padding: var(--space-4);
      }
    }
  </style>