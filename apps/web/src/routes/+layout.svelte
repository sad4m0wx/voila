<script>
  import "../app.css";
  import Navbar from "$components/core/Navbar.svelte";
  import AuthProvider from "$components/auth/AuthProvider.svelte";
  import MobileNavbar from "$components/core/MobileNavbar.svelte";
  import PullToRefresh from "$components/core/PullToRefresh.svelte";
  import MobileHeader from "$components/core/MobileHeader.svelte";
  import { onMount, setContext } from "svelte";
  import { page } from "$app/stores";
  
  // Import store refresh functions
  import { loadFriends, loadFriendRequests } from "$stores/friends";
  import { loadUserGroups, loadGroupInvites } from "$stores/groups";
  import { authStore } from "$stores/auth";
  
  // Import platform utilities
  import { setupKeyboard, setStatusBarDark, getDeviceInfo } from "$lib/utils/platform.js";

  let isMobile = false;
  let isRefreshing = false;

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

  // Smart refresh based on current page
  async function handleRefresh() {
    if (isRefreshing || !$authStore.user) return;
    
    isRefreshing = true;
    
    try {
      const currentPath = $page.url.pathname;
      const refreshPromises = [];

      // Only refresh data relevant to the current page
      if (currentPath === '/friends') {
        refreshPromises.push(loadFriends(), loadFriendRequests());
      } 
      else if (currentPath === '/groups' || currentPath.startsWith('/groups/')) {
        refreshPromises.push(loadUserGroups(), loadGroupInvites());
      }
      else if (currentPath === '/profile') {
        refreshPromises.push(loadFriends(), loadUserGroups());
      }
      else if (currentPath === '/') {

      }

      // Add more page-specific refresh logic as needed

      // Execute the relevant refreshes
      if (refreshPromises.length > 0) {
        await Promise.all(refreshPromises);
      }
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setTimeout(() => {
        isRefreshing = false;
      }, 500);
    }
  }

  // Check if current page is an auth page
  $: isAuthPage = $page.url.pathname.startsWith('/auth/');

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
        {#if $authStore.user && !isAuthPage}
        <MobileNavbar />
        {/if}
      </div>
    {:else}
      <!-- Desktop Layout (no pull-to-refresh) -->
      <Navbar />
      
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