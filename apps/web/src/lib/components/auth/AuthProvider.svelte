<!-- AuthProvider.svelte -->
<script>
  import { onMount, onDestroy, setContext } from 'svelte';
  import { writable, derived } from 'svelte/store';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { initAuth, authStore, isAuthenticated, isLoading, error } from '$stores/auth';
  
  export let requireAuth = false;
  
  // Local state
  const redirectPath = writable(null);
  const isRedirecting = writable(false);
  
  // Handle redirects based on auth state
  $: if (requireAuth && !$isLoading && !$isAuthenticated) {
    handleRedirectToLogin();
  }
  
  function handleRedirectToLogin() {
    if (!$isRedirecting) {
      isRedirecting.set(true);
      const currentPath = $page.url.pathname;
      redirectPath.set(currentPath);
      goto(`/login?redirect=${encodeURIComponent(currentPath)}`);
    }
  }
  
  // Provide auth context to child components
  setContext('auth', {
    user: derived(authStore, $auth => $auth.user),
    profile: derived(authStore, $auth => $auth.profile),
    isAuthenticated,
    isLoading,
    error,
    handleLoginRedirect
  });
  
  function handleLoginRedirect() {
    const params = new URLSearchParams($page.url.search);
    const redirect = params.get('redirect');
    return redirect || '/';
  }

  let unsubscribe;
  
  onMount(() => {
    unsubscribe = initAuth();
  });
  
  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
    }
  });
</script>

<!-- Loading overlay when auth is initializing -->
{#if $isLoading && requireAuth}
  <div class="auth-loading-overlay">
    <div class="loader"></div>
    <p>Loading...</p>
  </div>
{:else}
  <slot></slot>
{/if}

<style>
  .auth-loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.8);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }
</style>