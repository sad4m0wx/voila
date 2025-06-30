<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import PhoneVerification from "$components/auth/PhoneVerification.svelte";
  import BackButton from "$components/auth/BackButton.svelte";
  import { checkPhoneNumberExists } from "$stores/auth.js";
  
  // State
  let isSubmitting = false;
  let error = '';
  let redirectUrl = "/";
  let loginSuccess = false;
  let phoneVerified = false;
  
  // Get redirect URL from query parameter if present
  onMount(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get("redirect");
    if (redirect) {
      redirectUrl = redirect;
    }
  });
  
  // Handle phone verification completion
  async function handlePhoneVerified(event) {
    const { phoneNumber, user, mode } = event.detail;
    
    isSubmitting = true;
    error = '';

    try {
      // Check if user exists and is active
      const exists = await checkPhoneNumberExists(phoneNumber);
      
      if (!exists) {
        error = 'Account not found. Please check your phone number or create a new account.';
        isSubmitting = false;
        return;
      }
      
      // Since Firebase Auth handled the verification, the user is now authenticated
      // The auth state listener will handle loading the profile and addresses
      
      phoneVerified = true;
      isSubmitting = false;
      
      // Proceed directly to success
      proceedToSuccess();

    } catch (err) {
      console.error('Login error:', err);
      error = 'Failed to sign in. Please try again.';
      isSubmitting = false;
    }
  }

  function proceedToSuccess() {
    loginSuccess = true;
    
    // Redirect after a short delay
    setTimeout(() => {
      goto(redirectUrl, { replaceState: true });
    }, 1500);
  }
</script>

<svelte:head>
  <title>Sign In | Voilà!</title>
  <meta name="description" content="Sign in to your Voilà account" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
</svelte:head>

<div class="min-h-screen flex flex-col justify-center px-4 py-6 sm:py-12">
  <div class="max-w-md w-full mx-auto">
    {#if !loginSuccess}
      <BackButton href="/" label="Back to Home" />
    {/if}
    
    <div class="text-center mb-6 sm:mb-8">
      {#if loginSuccess}
        <h1 class="text-2xl sm:text-3xl font-bold text-green-600 mb-2">Welcome back!</h1>
        <p class="text-neutral-600">You've been signed in successfully</p>
      {:else}
        <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">Sign In</h1>
        <p class="text-neutral-600">Enter your phone number to continue</p>
      {/if}
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
      
      {#if loginSuccess}
        <!-- Success State -->
        <div class="text-center py-8">
          <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h3 class="text-lg font-medium text-gray-900 mb-2">Signed In Successfully!</h3>
          <p class="text-gray-600 mb-4">
            Welcome back! You're being redirected to your dashboard.
          </p>
          
          <div class="flex items-center justify-center">
            <div class="loader mr-2"></div>
            <span class="text-sm text-gray-500">Redirecting...</span>
          </div>
        </div>
      {:else}
        <!-- Phone Verification -->
        <PhoneVerification 
          mode="login"
          isLoading={isSubmitting}
          on:verified={handlePhoneVerified}
        />
      {/if}
    </div>
    
    {#if !loginSuccess}
      <div class="text-center mt-6">
        <p class="text-neutral-600 text-sm">
          Don't have an account? 
          <a href="/auth/register" class="text-primary-600 hover:text-primary-700 font-medium">Create one</a>
        </p>
      </div>
      
    {/if}
  </div>
</div>

<style>
  .card {
    background: white;
    border-radius: 0.75rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  .alert {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    border-radius: 0.5rem;
  }

  .alert-error {
    background-color: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
  }

  .loader {
    width: 1rem;
    height: 1rem;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>