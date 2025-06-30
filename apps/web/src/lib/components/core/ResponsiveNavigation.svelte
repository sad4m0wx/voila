<!-- Simple Responsive Navigation - Replaces MobileNavbar exactly -->
<script>
  import { page } from "$app/stores";

  const navItems = [
    {
      name: "Home",
      path: "/",
      icon: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      `,
    },
    {
      name: "Groups",
      path: "/groups",
      icon: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      `,
    },
    {
      name: "Test",
      path: "/test-contacts",
      icon: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 12l2 2 4-4"></path>
          <circle cx="12" cy="12" r="10"></circle>
        </svg>
      `,
    }
  ];

  // Get current path and check if it's active
  $: currentPath = $page.url.pathname;

  function isActive(path) {
    if (path === "/") {
      return currentPath === "/";
    }
    return currentPath.startsWith(path);
  }
</script>

<!-- Mobile Navigation (bottom bar) -->
<nav class="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-neutral-200/50 z-10 safe-area-bottom shadow-lg">
  <div class="grid grid-cols-3 h-18">
    {#each navItems as item}
      <a
        href={item.path}
        class="flex flex-col items-center justify-center transition-all duration-300 group relative {isActive(item.path) ? 'text-primary-600' : 'text-secondary-400'}"
        aria-current={isActive(item.path) ? "page" : undefined}
      >
        <!-- Active indicator -->
        {#if isActive(item.path)}
          <div class="absolute top-0 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-primary-600 rounded-full"></div>
        {/if}
        
        <div class="w-6 h-6 mb-1.5 transition-transform duration-300 {isActive(item.path) ? 'scale-110' : 'group-hover:scale-105'}">
          {@html item.icon}
        </div>
        <span class="text-xs font-medium transition-colors duration-300">{item.name}</span>
        
        <!-- Hover effect -->
        <div class="absolute inset-0 rounded-2xl bg-primary-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 m-2"></div>
      </a>
    {/each}
  </div>
</nav>

<!-- Desktop Navigation (horizontal) -->
<nav class="hidden md:block bg-white border-b border-gray-200 sticky top-16 z-40">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex space-x-8 py-4">
      {#each navItems as item}
        <a
          href={item.path}
          class="nav-item-desktop {isActive(item.path) ? 'active' : ''}"
          aria-current={isActive(item.path) ? "page" : undefined}
        >
          <div class="w-4 h-4">
            {@html item.icon}
          </div>
          <span class="ml-2">{item.name}</span>
        </a>
      {/each}
    </div>
  </div>
</nav>

<style>
  /* Handle iOS safe area */
  .safe-area-bottom {
    padding-bottom: env(safe-area-inset-bottom, 0);
    background-color: rgba(255, 255, 255, 0.95);
  }

  /* Make sure icons scale properly */
  nav :global(svg) {
    width: 100%;
    height: 100%;
  }

  /* Desktop Navigation Styles */
  .nav-item-desktop {
    @apply flex items-center px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors duration-200;
  }
  
  .nav-item-desktop.active {
    @apply text-blue-600 bg-blue-50;
  }
</style> 