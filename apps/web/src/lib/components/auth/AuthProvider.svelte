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
      goto(`/auth/login?redirect=${encodeURIComponent(currentPath)}`);
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
    <div class="loader-container">
      <div class="loader"></div>
    </div>
    <p class="mt-4 text-neutral-700 font-medium">Loading your account...</p>
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
    background: rgba(255, 255, 255, 0.9);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 0 1rem;
  }

  .loader-container {
    width: 3rem;
    height: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .loader {
    width: 2rem;
    height: 2rem;
    border: 3px solid #f3f3f3;
    border-top: 3px solid var(--color-primary, #4f46e5);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @media screen and (max-width: 640px) {
    .loader-container {
      width: 2.5rem;
      height: 2.5rem;
    }
    
    .loader {
      width: 1.75rem;
      height: 1.75rem;
      border-width: 2px;
    }
  }
</style>