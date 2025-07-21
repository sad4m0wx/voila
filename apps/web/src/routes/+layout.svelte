<script>
  import "../app.css";
  import AuthProvider from "$components/auth/AuthProvider.svelte";
  import ResponsiveNavigation from "$components/core/ResponsiveNavigation.svelte";
  import PullToRefresh from "$components/core/PullToRefresh.svelte";
  import { onMount, setContext } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  
  // Import store refresh functions
  import { loadFriends, loadFriendRequests } from "$stores/friends";
  import { loadUserGroups, loadGroupInvites } from "$stores/groups";
  import { authStore } from "$stores/auth";
  
  // Import platform utilities
  import { setupKeyboard, setStatusBarDark, getDeviceInfo } from "$lib/utils/platform.js";

  let isMobile = false;
  let isRefreshing = false;
  let previousAuthState = null;

  onMount(async () => {
    isMobile = isMobileDevice();
    
    // Initialize platform-specific features
    const deviceInfo = getDeviceInfo();
    if (deviceInfo.isNative) {
      try {
        await setupKeyboard();
        await setStatusBarDark();
      } catch (error) {
        console.warn('Platform initialization failed:', error);
      }
    }
    
    function handleResize() {
      isMobile = isMobileDevice();
    }
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });

  function isMobileDevice() {
    if (typeof window === "undefined") return false;
    return (
      window.innerWidth < 768 ||
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    );
  }

  // Auto-redirect logic for login/logout
  $: {
    if (!$authStore.isLoading) {
      const currentPath = $page.url.pathname;
      const isAuthPage = currentPath.startsWith('/auth/');
      
      // Handle logout - redirect to home if user logged out
      if (previousAuthState && previousAuthState.user && !$authStore.user && !isAuthPage) {
        goto('/', { replaceState: true });
      }
      
      // Handle login - redirect from auth pages if user is now logged in
      if (!previousAuthState?.user && $authStore.user && isAuthPage) {
        const urlParams = new URLSearchParams($page.url.search);
        const redirect = urlParams.get('redirect');
        goto(redirect || '/', { replaceState: true });
      }
      
      // Store current auth state for next comparison
      previousAuthState = $authStore;
    }
  }

  // Smart refresh based on current page
  async function handleRefresh() {
    if (!$authStore.user) return;
    
    isRefreshing = true;
    const currentPath = $page.url.pathname;
    
    try {
      if (currentPath === '/friends' || currentPath.startsWith('/friends')) {
        await Promise.all([loadFriends(), loadFriendRequests()]);
      } else if (currentPath === '/groups' || currentPath.startsWith('/groups')) {
        await Promise.all([loadUserGroups(), loadGroupInvites()]);
      } else {
        // Default refresh for other pages
        await Promise.all([loadFriends(), loadUserGroups()]);
      }
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      isRefreshing = false;
    }
  }

  // Check if current page is an auth page
  $: isAuthPage = $page.url.pathname.startsWith('/auth/');
  
  // Set context for mobile detection
  setContext("isMobile", isMobile);
</script>

<AuthProvider>
  <div class="min-h-screen bg-bg-main text-text-primary flex flex-col">
    {#if isMobile}
      <!-- Mobile Layout with Smart Pull-to-Refresh -->
      <div class="flex flex-col h-screen">
        <div class="flex-1 overflow-hidden">
          <PullToRefresh
            refreshing={isRefreshing}
            disabled={!$authStore.user} 
            on:refresh={handleRefresh}
          >
            <main class="min-h-full pb-20 px-4 pt-4">
              <slot />
            </main>
          </PullToRefresh>
        </div>
        <!-- Responsive Navigation - only show for authenticated users and not on auth pages -->
        {#if $authStore.user && !isAuthPage}
          <ResponsiveNavigation />
        {/if}
      </div>
    {:else}
      <!-- Desktop Layout (no pull-to-refresh) -->
      
      <main class="flex-grow container mx-auto px-4 py-8">
        <slot />
      </main>

      <footer class="py-8 border-t border-neutral-200 mt-16 bg-white">
        <div class="container mx-auto px-4 text-center text-sm text-neutral-500">
          <p>
            © {new Date().getFullYear()} Voilà! Find the perfect place to meet.
          </p>
        </div>
      </footer>
    {/if}
  </div>
</AuthProvider>