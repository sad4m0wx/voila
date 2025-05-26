<script>
  import "../app.css";
  import Navbar from "$lib/components/Navbar.svelte";
  import AuthProvider from "$lib/components/auth/AuthProvider.svelte";
  import MobileNavbar from "$lib/components/mobile/MobileNavbar.svelte";
  import PullToRefresh from "$lib/components/mobile/PullToRefresh.svelte";
import AuthDebug from "$lib/components/debug/AuthDebug.svelte";
  import { onMount, setContext } from "svelte";
  import { page } from "$app/stores";
  
  // Import store refresh functions
  import { loadFriends, loadFriendRequests } from "$stores/friends";
  import { loadUserGroups, loadGroupInvites } from "$stores/groups";
  import { authStore } from "$stores/auth";

  let isMobile = false;
  let isRefreshing = false;

  onMount(() => {
    isMobile = isMobileDevice();
    
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
      else if (currentPath.startsWith('/user/')) {
        // User profile pages might need friend data
        refreshPromises.push(loadFriends());
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

  setContext("isMobile", isMobile);
</script>

<AuthProvider>
  <div class="min-h-screen bg-bg-main text-text-primary flex flex-col">
    {#if isMobile}
      <!-- Mobile Layout with Smart Pull-to-Refresh -->
      <div class="flex flex-col h-screen">
        <MobileNavbar />
        
        <div class="flex-1 overflow-hidden">
          <PullToRefresh
            refreshing={isRefreshing}
            disabled={!$authStore.user} 
            on:refresh={handleRefresh}
          >
            <main class="min-h-full pb-20">
              <slot />
            </main>
          </PullToRefresh>
        </div>
      </div>
    {:else}
      <!-- Desktop Layout (no pull-to-refresh) -->
      <Navbar />
      
      <main class="flex-grow">
        <slot />
      </main>

      <footer class="py-6 border-t border-neutral-200 mt-12">
        <div class="container mx-auto px-4 text-center text-sm text-neutral-500">
          <p>
            © {new Date().getFullYear()} Voilà! Find the perfect place to meet.
          </p>
        </div>
      </footer>
    {/if}
  </div>
  
  <!-- Debug component (only shows in development) -->
  <AuthDebug />
</AuthProvider>