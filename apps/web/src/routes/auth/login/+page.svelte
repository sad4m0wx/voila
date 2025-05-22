<script>
  import { login, loginAsGuest, isAuthenticated } from "$stores/auth";
  import { onMount } from "svelte";
  import BackButton from "$lib/components/auth/BackButton.svelte";
  
  // State
  let email = "";
  let password = "";
  let isSubmitting = false;
  let error = "";
  let redirectUrl = "/";
  
  // Get redirect URL from query parameter if present
  onMount(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get("redirect");
    if (redirect) {
      redirectUrl = redirect;
    }
    
    // Redirect if already authenticated
    if ($isAuthenticated) {
      window.location.href = redirectUrl;
    }
  });
  
  // Handle form submission
  async function handleSubmit() {
    error = "";
    isSubmitting = true;
    
    try {
      const success = await login(email, password);
      
      if (success) {
        // Redirect after successful login
        window.location.href = redirectUrl;
      }
    } catch (err) {
      error = err.message;
    } finally {
      isSubmitting = false;
    }
  }
  
  // Handle guest login
  async function handleGuestLogin() {
    error = "";
    isSubmitting = true;
    
    try {
      const success = await loginAsGuest();
      
      if (success) {
        // Redirect after successful login
        window.location.href = redirectUrl;
      }
    } catch (err) {
      error = err.message;
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Sign In | Voilà!</title>
  <meta name="description" content="Sign in to your Voilà account to find perfect meeting spots" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
</svelte:head>

<div class="min-h-screen flex flex-col justify-center px-4 py-6 sm:py-12">
  <div class="max-w-md w-full mx-auto">
    <BackButton href="/" label="Back to Home" />
    
    <div class="text-center mb-8">
      <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">Welcome Back</h1>
      <p class="text-neutral-600">Sign in to continue to Voilà!</p>
    </div>
    
    <div class="card p-5 sm:p-6 shadow-md rounded-xl">
      {#if error}
        <div class="alert alert-error mb-5 p-3 text-sm rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <span class="ml-2">{error}</span>
        </div>
      {/if}
      
      <form on:submit|preventDefault={handleSubmit} class="space-y-5">
        <div>
          <label for="email" class="block text-neutral-700 font-medium text-sm mb-1.5">Email</label>
          <input 
            type="email" 
            id="email" 
            class="input w-full p-3 rounded-lg text-base" 
            bind:value={email}
            placeholder="Enter your email"
            required
            disabled={isSubmitting}
            autocomplete="email"
          />
        </div>
        
        <div>
          <div class="flex justify-between items-center mb-1.5">
            <label for="password" class="block text-neutral-700 font-medium text-sm">Password</label>
            <a href="/auth/reset-password" class="text-xs text-primary-600 hover:text-primary-700">Forgot password?</a>
          </div>
          <input 
            type="password" 
            id="password" 
            class="input w-full p-3 rounded-lg text-base" 
            bind:value={password}
            placeholder="Enter your password"
            required
            disabled={isSubmitting}
            autocomplete="current-password"
          />
        </div>
        
        <button 
          type="submit" 
          class="btn btn-primary w-full h-12 rounded-lg text-base font-medium" 
          disabled={isSubmitting}
        >
          {#if isSubmitting}
            <span class="loader loader-sm mr-2"></span>
            <span>Signing in...</span>
          {:else}
            Sign In
          {/if}
        </button>
        
        <div class="relative flex items-center justify-center my-4">
          <div class="border-t border-neutral-200 w-full absolute"></div>
          <span class="bg-bg-card px-2 text-xs text-neutral-500 relative">or</span>
        </div>
        
        <button 
          type="button" 
          class="btn btn-outline w-full h-12 rounded-lg text-base font-medium"
          on:click={handleGuestLogin}
          disabled={isSubmitting}
        >
          Continue as Guest
        </button>
      </form>
      
      <div class="text-center mt-6">
        <p class="text-neutral-600 text-sm">
          Don't have an account? 
          <a href="/auth/register" class="text-primary-600 hover:text-primary-700 font-medium">Create account</a>
        </p>
      </div>
    </div>
  </div>
</div>