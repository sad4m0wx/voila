<script>
  import { createEventDispatcher } from 'svelte';
  import { 
    sendVerificationCode, 
    verifyCode, 
    validatePhoneNumber, 
    formatPhoneNumber, 
    getCountryCodes,
    checkPhoneNumberExists,
    phoneVerification
  } from '$lib/stores/auth.js';

  const dispatch = createEventDispatcher();

  // Props
  export let mode = 'register'; // 'register' or 'login'
  export let isLoading = false;

  // State
  let step = 'phone'; // 'phone' or 'verify'
  let selectedCountryCode = '+1';
  let phoneNumber = '';
  let verificationCode = '';
  let verificationId = null;
  let error = '';
  let isSubmitting = false;
  let showCountryDropdown = false;
  let resendCooldown = 0;
  let resendTimer = null;

  // Get country codes
  const countryCodes = getCountryCodes();

  // Computed values
  $: fullPhoneNumber = selectedCountryCode + phoneNumber.replace(/[^\d]/g, '');
  $: isPhoneValid = validatePhoneNumber(fullPhoneNumber);
  $: isCodeValid = verificationCode.length === 6 && /^\d{6}$/.test(verificationCode);

  // Handle country code selection
  function selectCountryCode(code) {
    selectedCountryCode = code;
    showCountryDropdown = false;
  }

  // Handle phone number input
  function handlePhoneInput(event) {
    const value = event.target.value.replace(/[^\d]/g, '');
    phoneNumber = value;
    error = '';
  }

  // Handle verification code input
  function handleCodeInput(event) {
    const value = event.target.value.replace(/[^\d]/g, '').slice(0, 6);
    verificationCode = value;
    error = '';
  }

  // Send verification code
  async function handleSendCode() {
    if (!isPhoneValid) {
      error = 'Please enter a valid phone number';
      return;
    }

    isSubmitting = true;
    error = '';

    try {
      // Check if phone number exists for registration
      if (mode === 'register') {
        const exists = await checkPhoneNumberExists(fullPhoneNumber);
        if (exists) {
          error = 'This phone number is already registered. Try signing in instead.';
          isSubmitting = false;
          return;
        }
      } else if (mode === 'login') {
        const exists = await checkPhoneNumberExists(fullPhoneNumber);
        if (!exists) {
          error = 'This phone number is not registered. Try creating an account instead.';
          isSubmitting = false;
          return;
        }
      }

      const result = await sendVerificationCode(fullPhoneNumber);
      
      if (result.success) {
        verificationId = result.verificationId;
        step = 'verify';
        startResendCooldown();
      } else {
        error = result.error || 'Failed to send verification code';
      }
    } catch (err) {
      error = 'Failed to send verification code. Please try again.';
    } finally {
      isSubmitting = false;
    }
  }

  // Verify code
  async function handleVerifyCode() {
    if (!isCodeValid) {
      error = 'Please enter a valid 6-digit code';
      return;
    }

    isSubmitting = true;
    error = '';

    try {
      const result = await verifyCode(verificationId, verificationCode);
      
      if (result.success) {
        dispatch('verified', {
          phoneNumber: result.phoneNumber,
          user: result.user,
          mode
        });
      } else {
        error = result.error || 'Invalid verification code';
      }
    } catch (err) {
      error = 'Failed to verify code. Please try again.';
    } finally {
      isSubmitting = false;
    }
  }

  // Resend code
  async function handleResendCode() {
    if (resendCooldown > 0) return;
    
    verificationCode = '';
    await handleSendCode();
  }

  // Start resend cooldown
  function startResendCooldown() {
    resendCooldown = 60;
    resendTimer = setInterval(() => {
      resendCooldown--;
      if (resendCooldown <= 0) {
        clearInterval(resendTimer);
        resendTimer = null;
      }
    }, 1000);
  }

  // Go back to phone input
  function goBackToPhone() {
    step = 'phone';
    verificationCode = '';
    verificationId = null;
    error = '';
    if (resendTimer) {
      clearInterval(resendTimer);
      resendTimer = null;
      resendCooldown = 0;
    }
  }

  // Cleanup on destroy
  import { onDestroy } from 'svelte';
  onDestroy(() => {
    if (resendTimer) {
      clearInterval(resendTimer);
    }
  });

  // React to store errors
  $: if ($phoneVerification.error && !error) {
    error = $phoneVerification.error;
  }

  // React to store loading state
  $: if ($phoneVerification.isLoading !== isSubmitting) {
    isSubmitting = $phoneVerification.isLoading;
  }
</script>

<div class="phone-verification">
  {#if step === 'phone'}
    <!-- Phone Number Input Step -->
    <div class="space-y-4">
      <div>
        <label for="phone" class="block text-neutral-700 font-medium text-sm mb-1.5">
          Phone Number
        </label>
        
        <div class="flex">
          <!-- Country Code Dropdown -->
          <div class="relative">
            <button
              type="button"
              class="flex items-center px-3 py-3 border border-r-0 border-gray-300 rounded-l-lg bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              on:click={() => showCountryDropdown = !showCountryDropdown}
            >
              <span class="text-sm font-medium">{selectedCountryCode}</span>
              <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {#if showCountryDropdown}
              <div class="absolute top-full left-0 z-10 w-48 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {#each countryCodes as country}
                  <button
                    type="button"
                    class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center"
                    on:click={() => selectCountryCode(country.code)}
                  >
                    <span class="mr-2">{country.flag}</span>
                    <span class="mr-2 font-medium">{country.code}</span>
                    <span class="text-gray-500">{country.country}</span>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
          
          <!-- Phone Number Input -->
          <input
            type="tel"
            id="phone"
            class="flex-1 px-3 py-3 border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Enter your phone number"
            bind:value={phoneNumber}
            on:input={handlePhoneInput}
            disabled={isSubmitting}
            autocomplete="tel"
          />
        </div>
        
        {#if fullPhoneNumber && isPhoneValid}
          <p class="text-sm text-gray-600 mt-1">
            We'll send a verification code to {formatPhoneNumber(fullPhoneNumber)}
          </p>
        {/if}
      </div>

      {#if error}
        <div class="alert alert-error p-3 text-sm rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <span class="ml-2">{error}</span>
        </div>
      {/if}

      <button
        type="button"
        class="btn btn-primary w-full h-12 rounded-lg text-base font-medium"
        disabled={!isPhoneValid || isSubmitting}
        on:click={handleSendCode}
      >
        {#if isSubmitting}
          <span class="loader loader-sm mr-2"></span>
          <span>Sending code...</span>
        {:else}
          Send Verification Code
        {/if}
      </button>
    </div>

  {:else if step === 'verify'}
    <!-- Verification Code Input Step -->
    <div class="space-y-4">
      <div class="text-center">
        <h3 class="text-lg font-medium text-gray-900 mb-2">Enter Verification Code</h3>
        <p class="text-sm text-gray-600">
          We sent a 6-digit code to {formatPhoneNumber(fullPhoneNumber)}
        </p>
      </div>

      <div>
        <label for="code" class="block text-neutral-700 font-medium text-sm mb-1.5">
          Verification Code
        </label>
        <input
          type="text"
          id="code"
          class="input w-full p-3 rounded-lg text-base text-center tracking-widest"
          placeholder="000000"
          bind:value={verificationCode}
          on:input={handleCodeInput}
          disabled={isSubmitting}
          maxlength="6"
          autocomplete="one-time-code"
        />
      </div>

      {#if error}
        <div class="alert alert-error p-3 text-sm rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <span class="ml-2">{error}</span>
        </div>
      {/if}

      <button
        type="button"
        class="btn btn-primary w-full h-12 rounded-lg text-base font-medium"
        disabled={!isCodeValid || isSubmitting}
        on:click={handleVerifyCode}
      >
        {#if isSubmitting}
          <span class="loader loader-sm mr-2"></span>
          <span>Verifying...</span>
        {:else}
          Verify Code
        {/if}
      </button>

      <div class="text-center space-y-2">
        <button
          type="button"
          class="text-sm text-primary-600 hover:text-primary-700 disabled:text-gray-400 disabled:cursor-not-allowed"
          disabled={resendCooldown > 0 || isSubmitting}
          on:click={handleResendCode}
        >
          {#if resendCooldown > 0}
            Resend code in {resendCooldown}s
          {:else}
            Resend verification code
          {/if}
        </button>
        
        <div>
          <button
            type="button"
            class="text-sm text-gray-600 hover:text-gray-700"
            on:click={goBackToPhone}
          >
            Change phone number
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Click outside to close dropdown -->
{#if showCountryDropdown}
  <div 
    class="fixed inset-0 z-5" 
    on:click={() => showCountryDropdown = false}
  ></div>
{/if}

<style>
  .phone-verification {
    width: 100%;
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

  .loader-sm {
    width: 0.875rem;
    height: 0.875rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style> 