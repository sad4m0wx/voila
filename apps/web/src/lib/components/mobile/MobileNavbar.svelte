<!-- src/lib/components/mobile/BottomNav.svelte -->
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
            name: "Friends",
            path: "/friends",
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
            name: "Profile",
            path: "/profile",
            icon: `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        `,
        },
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

<nav
    class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10 safe-area-bottom"
>
    <div class="grid grid-cols-4 h-16">
        {#each navItems as item}
            <a
                href={item.path}
                class="flex flex-col items-center justify-center {isActive(
                    item.path,
                )
                    ? 'text-blue-500'
                    : 'text-gray-500'} 
                 transition-colors duration-200"
                aria-current={isActive(item.path) ? "page" : undefined}
            >
                <div class="w-6 h-6 mb-1">
                    {@html item.icon}
                </div>
                <span class="text-xs font-medium">{item.name}</span>
            </a>
        {/each}
    </div>
</nav>

<style>
    /* Handle iOS safe area */
    .safe-area-bottom {
        padding-bottom: env(safe-area-inset-bottom, 0);
        background-color: white;
    }

    /* Make sure icons scale properly */
    nav :global(svg) {
        width: 100%;
        height: 100%;
    }

    /* Fixed position to ensure it stays visible */
    nav {
        box-shadow: 0 -1px 3px rgba(0, 0, 0, 0.1);
    }
</style>
