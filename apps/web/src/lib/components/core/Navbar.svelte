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

<header class={`fixed w-full z-50 transition-all duration-300 ${isScrolled ? "glass shadow-lg py-3" : "bg-transparent py-6"}`}>
  <div class="container mx-auto px-4">
    <div class="flex justify-between items-center">
      <!-- Logo -->
      <a href="/" class="flex items-center group">
        <span class="text-3xl mr-3 group-hover:animate-bounce-subtle">📍</span>
        <span class="text-2xl font-bold text-gradient">Voilà!</span>
      </a>
      
      <!-- Desktop Navigation -->
      <nav class="hidden md:flex items-center space-x-8">
        <a href="/" class="nav-link">Home</a>
        
        {#if $isAuthenticated}
          <a href="/groups" class="nav-link">Groups</a>
          <a href="/friends" class="nav-link">Friends</a>
          <a href="/profile" class="nav-link">Profile</a>
          <button on:click={handleLogout} class="nav-link">Sign Out</button>
        {:else}
          <a href="/auth/login" class="nav-link">Sign In</a>
          <a href="/auth/register" class="btn btn-primary btn-sm">Sign Up</a>
        {/if}
      </nav>
    </div>
  </div>
</header>

<div class={isScrolled ? "h-20" : "h-24"}></div>