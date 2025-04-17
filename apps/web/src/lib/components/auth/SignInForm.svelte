<!-- apps/web/src/lib/components/auth/SignInForm.svelte -->
<script>
    import { createEventDispatcher } from 'svelte';
    import { login, loginAsGuest } from '$lib/stores/auth';
    
    // Props
    export let redirectUrl = '/';
    
    // Local state
    let email = '';
    let password = '';
    let isSubmitting = false;
    let error = '';
    
    const dispatch = createEventDispatcher();
    
    // Handle form submission
    async function handleSubmit() {
      error = '';
      isSubmitting = true;
      
      try {
        const success = await login(email, password);
        
        if (success) {
          dispatch('success');
          
          // Redirect if needed
          if (redirectUrl) {
            window.location.href = redirectUrl;
          }
        }
      } catch (err) {
        error = err.message;
      } finally {
        isSubmitting = false;
      }
    }
    
    // Handle guest login
    async function handleGuestLogin() {
      error = '';
      isSubmitting = true;
      
      try {
        const success = await loginAsGuest();
        
        if (success) {
          dispatch('success');
          
          // Redirect if needed
          if (redirectUrl) {
            window.location.href = redirectUrl;
          }
        }
      } catch (err) {
        error = err.message;
      } finally {
        isSubmitting = false;
      }
    }
  </script>
  
  <div class="card sign-in-form">
    <h2>Sign In</h2>
    
    {#if error}
      <div class="alert alert-error">
        <svg xmlns="http://www.w3.org/2000/svg" class="alert-icon" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        <span>{error}</span>
      </div>
    {/if}
    
    <form on:submit|preventDefault={handleSubmit}>
      <div class="input-wrapper mb-4">
        <label for="email">Email</label>
        <input 
          type="email" 
          id="email" 
          class="input" 
          bind:value={email} 
          placeholder="Enter your email" 
          required 
          disabled={isSubmitting}
        />
      </div>
      
      <div class="input-wrapper mb-6">
        <label for="password">Password</label>
        <input 
          type="password" 
          id="password" 
          class="input" 
          bind:value={password} 
          placeholder="Enter your password" 
          required 
          disabled={isSubmitting}
        />
      </div>
      
      <div class="actions">
        <button 
          type="submit" 
          class="btn btn-primary w-full" 
          disabled={isSubmitting}
        >
          {#if isSubmitting}
            <span class="loader loader-sm"></span>
            <span>Signing In...</span>
          {:else}
            <span>Sign In</span>
          {/if}
        </button>
        
        <div class="divider">or</div>
        
        <button 
          type="button" 
          class="btn btn-outline w-full"
          on:click={handleGuestLogin}
          disabled={isSubmitting}
        >
          Continue as Guest
        </button>
      </div>
      
      <div class="auth-links">
        <a href="/auth/register" class="auth-link">Create an Account</a>
        <a href="/auth/reset-password" class="auth-link">Forgot Password?</a>
      </div>
    </form>
  </div>
  
  <style>
    .sign-in-form {
      max-width: 400px;
      margin: 0 auto;
    }
    
    h2 {
      text-align: center;
      margin-bottom: var(--space-6);
    }
    
    .input-wrapper {
      margin-bottom: var(--space-4);
    }
    
    label {
      display: block;
      margin-bottom: var(--space-2);
      font-weight: var(--font-medium);
    }
    
    .actions {
      margin-bottom: var(--space-4);
    }
    
    .divider {
      display: flex;
      align-items: center;
      text-align: center;
      margin: var(--space-4) 0;
      color: var(--text-tertiary);
      font-size: var(--text-sm);
    }
    
    .divider::before,
    .divider::after {
      content: '';
      flex: 1;
      border-bottom: 1px solid var(--neutral-200);
    }
    
    .divider::before {
      margin-right: var(--space-3);
    }
    
    .divider::after {
      margin-left: var(--space-3);
    }
    
    .auth-links {
      display: flex;
      justify-content: space-between;
      font-size: var(--text-sm);
      margin-top: var(--space-4);
    }
    
    .auth-link {
      color: var(--primary-600);
      text-decoration: none;
    }
    
    .auth-link:hover {
      text-decoration: underline;
    }
  </style>
  