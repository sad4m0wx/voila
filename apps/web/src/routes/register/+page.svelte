<!-- apps/web/src/routes/auth/register/+page.svelte -->
<script>
    import RegisterForm from '$lib/components/auth/RegisterForm.svelte';
    import { isAuthenticated } from '$lib/stores/auth';
    import { onMount } from 'svelte';
    
    // Handle redirect if already authenticated
    onMount(() => {
      if ($isAuthenticated) {
        window.location.href = '/profile';
      }
    });
  </script>
  
  <svelte:head>
    <title>Create Account | Voilà!</title>
    <meta name="description" content="Create a Voilà account to find meeting spots with friends." />
  </svelte:head>
  
  <div class="auth-container">
    <div class="auth-logo">
      <span class="logo-pin">📍</span>
      <h1>Voilà!</h1>
    </div>
    
    <RegisterForm redirectUrl="/profile" />
  </div>
  
  <style>
    .auth-container {
      max-width: 400px;
      margin: 2rem auto;
      padding: 0 1rem;
    }
    
    .auth-logo {
      text-align: center;
      margin-bottom: 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }
    
    .logo-pin {
      font-size: 1.5rem;
    }
    
    h1 {
      color: var(--primary-700);
      font-size: var(--text-2xl);
      margin: 0;
    }
  </style>
  