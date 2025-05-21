<!-- src/lib/components/Navbar.svelte -->
<script>
  import { isAuthenticated, logout } from "$stores/auth";
  import { onMount } from "svelte";
  
  let isMenuOpen = false;
  let isScrolled = false;
  
  // Handle mobile menu toggle
  function toggleMenu() {
    isMenuOpen = !isMenuOpen;
  }
  
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
    window.location.href = "/";
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
      
      <!-- Mobile Menu Button -->
      <button class="md:hidden text-neutral-700" on:click={toggleMenu} aria-label="Toggle menu">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {#if isMenuOpen}
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          {:else}
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          {/if}
        </svg>
      </button>
    </div>
    
    <!-- Mobile Menu -->
    {#if isMenuOpen}
      <div class="md:hidden pt-4 pb-2">
        <div class="flex flex-col space-y-3">
          <a href="/" class="text-neutral-700 hover:text-primary-600 font-medium py-2">Home</a>
          
          {#if $isAuthenticated}
            <a href="/groups" class="text-neutral-700 hover:text-primary-600 font-medium py-2">Groups</a>
            <a href="/friends" class="text-neutral-700 hover:text-primary-600 font-medium py-2">Friends</a>
            <a href="/profile" class="text-neutral-700 hover:text-primary-600 font-medium py-2">Profile</a>
            <button on:click={handleLogout} class="text-neutral-700 hover:text-primary-600 font-medium text-left py-2">Sign Out</button>
          {:else}
            <a href="/auth/login" class="text-neutral-700 hover:text-primary-600 font-medium py-2">Sign In</a>
            <a href="/auth/register" class="btn btn-primary w-full">Sign Up</a>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</header>

<div class={isScrolled ? "h-16" : "h-20"}></div>