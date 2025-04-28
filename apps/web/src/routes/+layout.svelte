<!-- src/routes/+layout.svelte -->
<script>
  import '../app.css';
  import Navbar from '$lib/components/Navbar.svelte';
  import AuthProvider from '$lib/components/auth/AuthProvider.svelte';
  import MobileNavbar from '$lib/components/mobile/MobileNavbar.svelte';
  import { onMount } from 'svelte';
  import { isMobileDevice } from '$lib/services/responsive';
  
  let isMobile = false;
  
  onMount(() => {
    isMobile = isMobileDevice();
  });
</script>

<AuthProvider>
	<div class="min-h-screen bg-bg-main text-text-primary flex flex-col">
  {#if isMobile}
    <MobileNavbar />
  {:else}
    <Navbar />
  {/if}
  
  <main class="flex-grow {isMobile ? 'pb-20' : ''}">
    <slot />
  </main>
  
  {#if !isMobile}
    <footer class="py-6 border-t border-neutral-200 mt-12">
      <div class="container mx-auto px-4 text-center text-sm text-neutral-500">
        <p>© {new Date().getFullYear()} Voilà! Find the perfect place to meet.</p>
      </div>
    </footer>
  {/if}
</div>
</AuthProvider>
