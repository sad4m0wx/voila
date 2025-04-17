
  <!-- apps/web/src/routes/profile/+page.svelte -->
  <script>
    import AuthProvider from '$lib/components/auth/AuthProvider.svelte';
    import UserProfile from '$lib/components/auth/UserProfile.svelte';
    import { isAuthenticated, isLoading } from '$lib/stores/auth';
    import { onMount } from 'svelte';
    
    // Redirect if not authenticated after loading completes
    onMount(() => {
      const checkAuth = () => {
        if (!$isLoading && !$isAuthenticated) {
          window.location.href = '/auth/login';
        }
      };
      
      // Check immediately
      checkAuth();
      
      // Set up watcher for auth state changes
      const unwatch = isAuthenticated.subscribe(value => {
        if (!$isLoading) {
          checkAuth();
        }
      });
      
      return unwatch;
    });
  </script>
  
  <svelte:head>
    <title>My Profile | Voilà!</title>
  </svelte:head>
  
  <AuthProvider>
    <div class="profile-page">
      <h1>My Profile</h1>
      <UserProfile />
    </div>
  </AuthProvider>
  
  <style>
    .profile-page {
      max-width: 800px;
      margin: 2rem auto;
      padding: 0 1rem;
    }
    
    h1 {
      margin-bottom: 2rem;
      color: var(--primary-700);
    }
  </style>
  