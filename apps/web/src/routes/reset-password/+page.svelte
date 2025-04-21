<!-- src/routes/reset-password/+page.svelte -->
<script>
    import { sendPasswordReset, isAuthenticated } from "$stores/auth";
    import { onMount } from "svelte";
    
    // State
    let email = "";
    let isSubmitting = false;
    let error = "";
    let success = false;
    
    // Redirect if already authenticated
    onMount(() => {
      if ($isAuthenticated) {
        window.location.href = "/";
      }
    });
    
    // Handle form submission
    async function handleSubmit() {
      error = "";
      success = false;
      isSubmitting = true;
      
      try {
        const result = await sendPasswordReset(email);
        
        if (result) {
          success = true;
          email = ""; // Clear email field after success
        } else {
          error = "Failed to send reset email. Please try again.";
        }
      } catch (err) {
        error = err.message;
      } finally {
        isSubmitting = false;
      }
    }
  </script>
  
  <svelte:head>
    <title>Reset Password | Voilà!</title>
    <meta name="description" content="Reset your Voilà account password" />
  </svelte:head>
  
  <div class="container mx-auto px-4 py-12">
    <div class="max-w-md mx-auto">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-neutral-900 mb-2">Reset Password</h1>
        <p class="text-neutral-600">Enter your email to receive a password reset link</p>
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
        
        {#if success}
          <div class="alert bg-success bg-opacity-10 border-l-4 border-success text-success mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <div>
              <p class="font-medium">Password reset email sent!</p>
              <p class="text-sm mt-1">Check your email for instructions to reset your password.</p>
            </div>
          </div>
        {/if}
        
        <form on:submit|preventDefault={handleSubmit}>
          <div class="mb-6">
            <label for="email" class="block text-neutral-700 font-medium mb-2">Email Address</label>
            <input 
              type="email" 
              id="email" 
              class="input w-full" 
              bind:value={email}
              placeholder="Enter your email address"
              required
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
              <span>Sending...</span>
            {:else}
              Send Reset Link
            {/if}
          </button>
        </form>
        
        <div class="text-center">
          <p class="text-neutral-600">
            Remember your password? 
            <a href="/login" class="text-primary-600 hover:text-primary-700 font-medium">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  </div>