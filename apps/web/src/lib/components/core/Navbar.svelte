<!-- src/lib/components/Navbar.svelte -->
<script>
import { isAuthenticated, logout } from "$stores/auth";
import { onMount } from "svelte";
import { goto } from "$app/navigation";
  
  let isScrolled = false;
  
  // Add scroll event listener
  onMount(() => {
    const handleScroll = () => {
      isScrolled = window.scrollY > 10;
    };
    
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  });
  
  // Handle logout
  async function handleLogout() {
    await logout();
    goto("/", { replaceState: true });
}
</script>

<header class={`fixed w-full z-50 transition-all duration-200 ${isScrolled ? "bg-white shadow-md py-2" : "bg-transparent py-4"}`}>
  <div class="container mx-auto px-4">
    <div class="flex justify-between items-center">
      <!-- Logo -->
      <a href="/" class="flex items-center">
        <span class="text-2xl mr-2">📍</span>
        <span class="text-xl font-bold text-primary-700">Voilà!</span>
      </a>
      
      <!-- Desktop Navigation -->
      <nav class="hidden md:flex items-center space-x-6">
        <a href="/" class="text-neutral-700 hover:text-primary-600 font-medium">Home</a>
        
        {#if $isAuthenticated}
          <a href="/groups" class="text-neutral-700 hover:text-primary-600 font-medium">Groups</a>
          <a href="/friends" class="text-neutral-700 hover:text-primary-600 font-medium">Friends</a>
          <a href="/profile" class="text-neutral-700 hover:text-primary-600 font-medium">Profile</a>
          <button on:click={handleLogout} class="text-neutral-700 hover:text-primary-600 font-medium">Sign Out</button>
        {:else}
          <a href="/auth/login" class="text-neutral-700 hover:text-primary-600 font-medium">Sign In</a>
          <a href="/auth/register" class="btn btn-primary">Sign Up</a>
        {/if}
      </nav>
  </div>
</header>

<div class={isScrolled ? "h-16" : "h-20"}></div>