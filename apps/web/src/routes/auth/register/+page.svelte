<!-- src/routes/register/+page.svelte -->
<script>
  import { register, isAuthenticated } from "$stores/auth";
  import { onMount } from "svelte";
  
  // State
  let email = "";
  let password = "";
  let confirmPassword = "";
  let displayName = "";
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
    
    // Validate passwords match
    if (password !== confirmPassword) {
      error = "Passwords do not match";
      return;
    }
    
    // Validate password length
    if (password.length < 6) {
      error = "Password must be at least 6 characters";
      return;
    }
    
    isSubmitting = true;
    
    try {
      const success = await register(email, password, displayName);
      
      if (success) {
        // Redirect after successful registration
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
  <title>Create Account | Voilà!</title>
  <meta name="description" content="Create your Voilà account to find perfect meeting spots" />
</svelte:head>

<div class="container mx-auto px-4 py-12">
  <div class="max-w-md mx-auto">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-neutral-900 mb-2">Create Account</h1>
      <p class="text-neutral-600">Join Voilà and start finding perfect meeting spots!</p>
    </div>
    
    <div class="card p-6 shadow-md">
      {#if error}
        <div class="alert alert-error mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" class="alert-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
      {/if}
      
      <form on:submit|preventDefault={handleSubmit}>
        <div class="mb-4">
          <label for="displayName" class="block text-neutral-700 font-medium mb-2">Full Name</label>
          <input 
            type="text" 
            id="displayName" 
            class="input w-full" 
            bind:value={displayName}
            placeholder="Enter your name"
            required
            disabled={isSubmitting}
          />
        </div>
        
        <div class="mb-4">
          <label for="email" class="block text-neutral-700 font-medium mb-2">Email</label>
          <input 
            type="email" 
            id="email" 
            class="input w-full" 
            bind:value={email}
            placeholder="Enter your email"
            required
            disabled={isSubmitting}
          />
        </div>
        
        <div class="mb-4">
          <label for="password" class="block text-neutral-700 font-medium mb-2">Password</label>
          <input 
            type="password" 
            id="password" 
            class="input w-full" 
            bind:value={password}
            placeholder="Create a password (min. 6 characters)"
            required
            minlength="6"
            disabled={isSubmitting}
          />
        </div>
        
        <div class="mb-6">
          <label for="confirmPassword" class="block text-neutral-700 font-medium mb-2">Confirm Password</label>
          <input 
            type="password" 
            id="confirmPassword" 
            class="input w-full" 
            bind:value={confirmPassword}
            placeholder="Confirm your password"
            required
            minlength="6"
            disabled={isSubmitting}
          />
        </div>
        
        <button 
          type="submit" 
          class="btn btn-primary w-full mb-6" 
          disabled={isSubmitting}
        >
          {#if isSubmitting}
            <span class="loader loader-sm mr-2"></span>
            <span>Creating account...</span>
          {:else}
            Create Account
          {/if}
        </button>
      </form>
      
      <div class="text-center">
        <p class="text-neutral-600">
          Already have an account? 
          <a href="/login" class="text-primary-600 hover:text-primary-700 font-medium">Sign in</a>
        </p>
      </div>
    </div>
  </div>
</div>