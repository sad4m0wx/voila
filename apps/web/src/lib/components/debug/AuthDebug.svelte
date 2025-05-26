<script>
  import { authStore, isAuthenticated, isLoading, error } from '$stores/auth';
  
  let showDebug = false;
  
  function toggleDebug() {
    showDebug = !showDebug;
  }
</script>

<!-- Debug toggle button (only show in development) -->
{#if import.meta.env.DEV}
  <button 
    on:click={toggleDebug}
    class="fixed bottom-4 right-4 z-50 bg-red-500 text-white px-3 py-2 rounded-full text-xs font-mono"
    style="z-index: 9999;"
  >
    🐛 Debug
  </button>

  {#if showDebug}
    <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-lg p-6 max-w-md w-full max-h-96 overflow-y-auto">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-bold">Auth Debug Info</h3>
          <button on:click={toggleDebug} class="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        
        <div class="space-y-3 text-sm font-mono">
          <div>
            <strong>Is Authenticated:</strong> 
            <span class={$isAuthenticated ? 'text-green-600' : 'text-red-600'}>
              {$isAuthenticated}
            </span>
          </div>
          
          <div>
            <strong>Is Loading:</strong> 
            <span class={$isLoading ? 'text-yellow-600' : 'text-gray-600'}>
              {$isLoading}
            </span>
          </div>
          
          {#if $error}
            <div>
              <strong>Error:</strong> 
              <span class="text-red-600">{$error}</span>
            </div>
          {/if}
          
          <div>
            <strong>User:</strong>
            <pre class="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
{JSON.stringify($authStore.user, null, 2)}
            </pre>
          </div>
          
          <div>
            <strong>Profile:</strong>
            <pre class="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
{JSON.stringify($authStore.profile, null, 2)}
            </pre>
          </div>
          
          <div>
            <strong>Auth Timing:</strong>
            <div class="bg-gray-100 p-2 rounded text-xs">
              <div>Loading: {$isLoading ? '🟡 Yes' : '🟢 No'}</div>
              <div>User: {$authStore.user ? '🟢 Present' : '🔴 Null'}</div>
              <div>Profile: {$authStore.profile ? '🟢 Loaded' : '🔴 Not loaded'}</div>
            </div>
          </div>
          
          <div>
            <strong>Environment Check:</strong>
            <div class="bg-gray-100 p-2 rounded text-xs">
              <div>API Key: {import.meta.env.VITE_FIREBASE_API_KEY ? '✅ Set' : '❌ Missing'}</div>
              <div>Auth Domain: {import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ? '✅ Set' : '❌ Missing'}</div>
              <div>Project ID: {import.meta.env.VITE_FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing'}</div>
              <div>App ID: {import.meta.env.VITE_FIREBASE_APP_ID ? '✅ Set' : '❌ Missing'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  pre {
    white-space: pre-wrap;
    word-break: break-all;
  }
</style>