
<!-- apps/web/src/routes/groups/+page.svelte -->
<script>
    import { onMount } from 'svelte';
    import AuthProvider from '$lib/components/auth/AuthProvider.svelte';
    import { isAuthenticated, isLoading as authLoading } from '$lib/stores/auth';
    import GroupsList from '$lib/components/groups/GroupsList.svelte';
    import GroupInvites from '$lib/components/groups/GroupInvites.svelte';
    import { loadGroupInvites, groupInvites } from '$lib/stores/groups';
    
    onMount(() => {
      // Redirect if not authenticated after loading completes
      const unsubscribe = isAuthenticated.subscribe(value => {
        if (!$authLoading && !value) {
          window.location.href = '/auth/login?redirect=/groups';
        }
      });
      
      // Load group invites
      loadGroupInvites();
      
      return unsubscribe;
    });
  </script>
  
  <svelte:head>
    <title>My Groups | Voilà!</title>
    <meta name="description" content="Manage your groups on Voilà" />
  </svelte:head>
  
  <AuthProvider>
    <div class="groups-page">
      <div class="page-header">
        <h1>My Groups</h1>
      </div>
      
      {#if $groupInvites && $groupInvites.length > 0}
        <GroupInvites />
      {/if}
      
      <GroupsList />
    </div>
  </AuthProvider>
  
  <style>
    .groups-page {
      max-width: 800px;
      margin: 0 auto;
      padding: var(--space-4);
    }
    
    .page-header {
      margin-bottom: var(--space-6);
    }
    
    h1 {
      font-size: var(--text-3xl);
      color: var(--text-primary);
      margin: 0;
    }
    
    @media (max-width: 768px) {
      .page-header {
        margin-bottom: var(--space-4);
      }
      
      h1 {
        font-size: var(--text-2xl);
      }
    }
  </style>