<!-- apps/web/src/routes/groups/[id]/+page.svelte -->
<script>
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import AuthProvider from '$lib/components/auth/AuthProvider.svelte';
    import { isAuthenticated, isLoading as authLoading } from '$lib/stores/auth';
    import { loadGroup, currentGroup, isLoading } from '$lib/stores/groups';
    import GroupDetail from '$lib/components/groups/GroupDetail.svelte';
    import GroupMembers from '$lib/components/groups/GroupMembers.svelte';
    
    // Get group ID from URL parameter
    const groupId = $page.params.id;
    
    onMount(() => {
      // Redirect if not authenticated after loading completes
      const unsubscribe = isAuthenticated.subscribe(value => {
        if (!$authLoading && !value) {
          window.location.href = `/auth/login?redirect=/groups/${groupId}`;
        }
      });
      
      // Load the group
      loadGroup(groupId);
      
      return unsubscribe;
    });
  </script>
  
  <svelte:head>
    <title>{$currentGroup ? $currentGroup.name : 'Group'} | Voilà!</title>
    <meta name="description" content="View group details on Voilà" />
  </svelte:head>
  
  <AuthProvider>
    <div class="group-detail-page">
      {#if $isLoading}
        <div class="loading-state">
          <div class="loader"></div>
          <p>Loading group...</p>
        </div>
      {:else}
        <div class="group-content">
          <GroupDetail {groupId} />
          <GroupMembers {groupId} />
        </div>
      {/if}
    </div>
  </AuthProvider>
  
  <style>
    .group-detail-page {
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
    
    @media (max-width: 768px) {
      .group-detail-page {
        padding: var(--space-3);
      }
    }
  </style>