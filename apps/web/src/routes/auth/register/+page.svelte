<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import BackButton from "$components/auth/BackButton.svelte";
  import PhoneVerification from "$components/auth/PhoneVerification.svelte";
  import AddressSetup from "$components/auth/AddressSetup.svelte";
  import { createAddress, createUserProfile } from "$stores/auth.js";
  
  // State
  let step = 'phone'; // 'phone', 'profile', 'address', 'complete'
  let phoneNumber = '';
  let displayName = '';
  let isSubmitting = false;
  let error = '';
  let redirectUrl = "/";
  let verifiedPhoneNumber = '';
  let verifiedUser = null;
  
  // Get redirect URL from query parameter if present
  onMount(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get("redirect");
    if (redirect) {
      redirectUrl = redirect;
    }
  });
  
  // Handle phone verification completion
  function handlePhoneVerified(event) {
    const { phoneNumber: phone, user, mode } = event.detail;
    verifiedPhoneNumber = phone;
    phoneNumber = phone;
    verifiedUser = user; // Store the user object
    step = 'profile';
  }

  // Handle profile setup
  async function handleProfileSetup() {
    if (!displayName.trim()) {
      error = 'Please enter your name';
      return;
    }

    step = 'address';
    error = '';
  }

  // Handle address setup completion
  async function handleAddressSetup(event) {
    const { address } = event.detail;
    
    isSubmitting = true;
    error = '';

    try {
      // Create user profile with UID as ID
      const profileResult = await createUserProfile(verifiedUser.uid, verifiedPhoneNumber, displayName);
      
      if (!profileResult.success) {
        throw new Error(profileResult.error || 'Failed to create user profile');
      }

      // Create the first address using the user's UID
      const addressResult = await createAddress(verifiedUser.uid, address);
      
      if (!addressResult.success) {
        throw new Error(addressResult.error || 'Failed to save address');
      }

      // Complete registration directly
      completeRegistration();

    } catch (err) {
      console.error('Registration error:', err);
      error = err.message || 'Failed to complete registration. Please try again.';
      isSubmitting = false;
    }
  }

  function completeRegistration() {
    step = 'complete';
    
    // Redirect after a short delay
    setTimeout(() => {
      goto(redirectUrl, { replaceState: true });
    }, 2000);
  }

  // Go back to previous step
  function goBack() {
    error = '';
    
    switch (step) {
      case 'profile':
        step = 'phone';
        break;
      case 'address':
        step = 'profile';
        break;
      default:
        goto('/auth/login');
    }
  }
</script>

<svelte:head>
  <title>Create Account | Voilà!</title>
  <meta name="description" content="Create your Voilà account to find perfect meeting spots" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
</svelte:head>

<div class="min-h-screen flex flex-col justify-center px-4 py-6 sm:py-12">
  <div class="max-w-md w-full mx-auto">
    {#if step !== 'complete'}
      <BackButton 
        href={step === 'phone' ? '/auth/login' : null} 
        label={step === 'phone' ? 'Back to Sign In' : 'Back'}
        on:click={step !== 'phone' ? goBack : null}
      />
    {/if}
    
    <div class="text-center mb-6 sm:mb-8">
      {#if step === 'phone'}
        <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">Create Account</h1>
        <p class="text-neutral-600">Enter your phone number to get started</p>
      {:else if step === 'profile'}
        <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">Tell us about yourself</h1>
        <p class="text-neutral-600">What should we call you?</p>
      {:else if step === 'address'}
        <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">Almost done!</h1>
        <p class="text-neutral-600">Add your first address to start finding meeting spots</p>
      {:else if step === 'complete'}
        <h1 class="text-2xl sm:text-3xl font-bold text-green-600 mb-2">Welcome to Voilà!</h1>
        <p class="text-neutral-600">Your account has been created successfully</p>
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
      
      {#if step === 'phone'}
        <!-- Phone Verification Step -->
        <PhoneVerification 
          mode="register"
          on:verified={handlePhoneVerified}
        />
        
      {:else if step === 'profile'}
        <!-- Profile Setup Step -->
        <form on:submit|preventDefault={handleProfileSetup} class="space-y-4">
          <div>
            <label for="displayName" class="block text-neutral-700 font-medium text-sm mb-1.5">
              Full Name
            </label>
            <input 
              type="text" 
              id="displayName" 
              class="input w-full p-3 rounded-lg text-base" 
              bind:value={displayName}
              placeholder="Enter your full name"
              required
              disabled={isSubmitting}
              autocomplete="name"
            />
          </div>
          
          <button 
            type="submit" 
            class="btn btn-primary w-full h-12 rounded-lg text-base font-medium mt-6" 
            disabled={!displayName.trim() || isSubmitting}
          >
            Continue
          </button>
        </form>
        
      {:else if step === 'address'}
        <!-- Address Setup Step -->
        <AddressSetup 
          isLoading={isSubmitting}
          on:address-setup={handleAddressSetup}
        />
        
      {:else if step === 'complete'}
        <!-- Completion Step -->
        <div class="text-center py-8">
          <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h3 class="text-lg font-medium text-gray-900 mb-2">Account Created!</h3>
          <p class="text-gray-600 mb-4">
            Welcome to Voilà, {displayName}! You can now start creating groups and finding perfect meeting spots.
          </p>
          
          <div class="flex items-center justify-center">
            <div class="loader mr-2"></div>
            <span class="text-sm text-gray-500">Redirecting...</span>
          </div>
        </div>
      {/if}
    </div>
    
    {#if step === 'phone'}
      <div class="text-center mt-6">
        <p class="text-neutral-600 text-sm">
          Already have an account? 
          <a href="/auth/login" class="text-primary-600 hover:text-primary-700 font-medium">Sign in</a>
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

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 1rem;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background-color: #3b82f6;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: #2563eb;
  }

  .input {
    border: 1px solid #d1d5db;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
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