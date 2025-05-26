<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { validatePhoneNumber, formatPhoneNumber, getCountryCodes } from '$stores/auth';

  const dispatch = createEventDispatcher();

  // Props
  export let value = '';
  export let placeholder = 'Enter phone number';
  export let disabled = false;
  export let required = false;
  export let label = 'Phone Number';
  export let showLabel = true;
  export let showValidation = true;
  export let id = 'phone-input';
  export let selectedCountryCode = '+1';
  export let size = 'md'; // 'sm', 'md', 'lg'

  // State
  let phoneNumber = '';
  let showCountryDropdown = false;
  let initialized = false;

  // Get country codes
  const countryCodes = getCountryCodes();

  // Computed values
  $: fullPhoneNumber = selectedCountryCode + phoneNumber.replace(/[^\d]/g, '');
  $: isPhoneValid = validatePhoneNumber(fullPhoneNumber);

  // Size classes
  $: sizeClasses = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  };

  // Handle country code selection
  function selectCountryCode(code) {
    selectedCountryCode = code;
    showCountryDropdown = false;
    const newFullNumber = code + phoneNumber.replace(/[^\d]/g, '');
    dispatch('countryChange', { countryCode: code });
    dispatch('change', { value: newFullNumber, isValid: validatePhoneNumber(newFullNumber) });
  }

  // Handle phone number input
  function handlePhoneInput(event) {
    const inputValue = event.target.value.replace(/[^\d]/g, '');
    phoneNumber = inputValue;
    const newFullNumber = selectedCountryCode + inputValue;
    dispatch('input', { value: newFullNumber, isValid: validatePhoneNumber(newFullNumber) });
    dispatch('change', { value: newFullNumber, isValid: validatePhoneNumber(newFullNumber) });
  }

  // Initialize from external value
  onMount(() => {
    if (value) {
      initializeFromValue(value);
    }
    initialized = true;
  });

  // Watch for external value changes after initialization
  $: if (initialized && value && value !== fullPhoneNumber) {
    initializeFromValue(value);
  }

  function initializeFromValue(val) {
    // Parse external value to extract country code and phone number
    const codes = countryCodes.map(c => c.code).sort((a, b) => b.length - a.length);
    const matchingCode = codes.find(code => val.startsWith(code));
    if (matchingCode) {
      selectedCountryCode = matchingCode;
      phoneNumber = val.slice(matchingCode.length);
    }
  }
</script>

<div class="phone-input">
  {#if showLabel}
    <label for={id} class="block text-sm font-medium text-gray-700 mb-1">
      {label}
      {#if required}
        <span class="text-red-500">*</span>
      {/if}
    </label>
  {/if}
  
  <div class="flex">
    <!-- Country Code Dropdown -->
    <div class="relative">
      <button
        type="button"
        class="flex items-center border border-r-0 border-gray-300 rounded-l-md bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 {sizeClasses[size]}"
        on:click={() => showCountryDropdown = !showCountryDropdown}
        {disabled}
      >
        <span class="font-medium">{selectedCountryCode}</span>
        <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {#if showCountryDropdown}
        <div class="absolute top-full left-0 z-20 w-48 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
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
      {id}
      value={phoneNumber}
      on:input={handlePhoneInput}
      {placeholder}
      {disabled}
      {required}
      class="flex-1 block w-full border border-gray-300 rounded-r-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 {sizeClasses[size]}"
      autocomplete="tel"
    />
  </div>
  
  {#if showValidation && fullPhoneNumber && isPhoneValid}
    <p class="text-sm text-gray-600 mt-1">
      {formatPhoneNumber(fullPhoneNumber)}
    </p>
  {/if}
</div>

<!-- Click outside to close dropdown -->
{#if showCountryDropdown}
  <div 
    class="fixed inset-0 z-10" 
    on:click={() => showCountryDropdown = false}
  ></div>
{/if}

<style>
  .phone-input {
    position: relative;
  }
</style> 