<!-- apps/web/src/routes/groups/create/+page.svelte -->
<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import AuthProvider from '$lib/components/auth/AuthProvider.svelte';
    import { isAuthenticated, isLoading as authLoading } from '$lib/stores/auth';
    import CreateGroup from '$lib/components/groups/CreateGroup.svelte';
    
    onMount(() => {
      // Redirect if not authenticated after loading completes
      const unsubscribe = isAuthenticated.subscribe(value => {
        if (!$authLoading && !value) {
          window.location.href = '/auth/login?redirect=/groups/create';
        }
      });
      
      return unsubscribe;
    });
    
    // Handle successful group creation
    function handleGroupCreated(event) {
      const { group } = event.detail;
      
      // We'll let the CreateGroup component handle redirection
    }
    
    // Handle cancellation
    function handleCancel() {
      goto('/groups');
    }
  </script>
  
  <svelte:head>
    <title>Create Group | Voilà!</title>
    <meta name="description" content="Create a new group on Voilà" />
  </svelte:head>
  
  <AuthProvider>
    <div class="create-group-page">
      <div class="page-header">
        <button class="back-button" on:click={() => goto('/groups')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>Back to Groups</span>
        </button>
      </div>
      
      <div class="group-form">
        <CreateGroup
          on:created={handleGroupCreated}
          on:cancel={handleCancel}
        />
      </div>
    </div>
  </AuthProvider>
  
  <style>
    .create-group-page {
      max-width: 800px;
      margin: 0 auto;
      padding: var(--space-4);
    }
    
    .page-header {
      margin-bottom: var(--space-6);
    }
    
    .back-button {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--primary-600);
      background: none;
      border: none;
      cursor: pointer;
      font-weight: var(--font-medium);
      padding: 0;
      transition: color var(--transition-fast);
    }
    
    .back-button:hover {
      color: var(--primary-700);
    }
    
    .group-form {
      background-color: var(--bg-card);
      border-radius: var(--radius-lg);
      padding: var(--space-6);
      box-shadow: var(--shadow-md);
    }
    
    @media (max-width: 768px) {
      .group-form {
        padding: var(--space-4);
      }
    }
  </style>