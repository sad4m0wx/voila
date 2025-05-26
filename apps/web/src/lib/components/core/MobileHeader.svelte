<script>
  import { isAuthenticated, user } from "$stores/auth";
</script>

<header
    class="sticky top-0 left-0 right-0 bg-white border-b border-blue-200 z-10"
>
    <div class="safe-area-top"></div>
    <div class="px-4 py-3 flex justify-between items-center">
        <div class="flex items-center">
            <span class="text-xl font-bold text-primary-700">📍 Voilà!</span>
        </div>
        
        <div class="flex items-center gap-2">
            {#if $isAuthenticated}
              <a href="/profile" class="flex items-center">
                <div class="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 border border-primary-200">
                  {#if $user?.name}
                    <span>{$user.name.charAt(0)}</span>
                  {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  {/if}
                </div>
              </a>
            {:else}
              <a href="/auth/login" class="text-sm font-medium text-primary-700">Login</a>
            {/if}
        </div>
    </div>
</header>

<style>
    /* Handle iOS safe area */
    .safe-area-top {
        height: env(safe-area-inset-top, 0px);
        background-color: white;
    }

    header {
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
</style>
