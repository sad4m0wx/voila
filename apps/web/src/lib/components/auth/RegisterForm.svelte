<!-- apps/web/src/lib/components/auth/RegisterForm.svelte -->
<script>
    import { createEventDispatcher } from "svelte";
    import { register } from "$lib/stores/auth";

    // Props
    export let redirectUrl = "/";

    // Local state
    let email = "";
    let password = "";
    let confirmPassword = "";
    let displayName = "";
    let isSubmitting = false;
    let error = "";

    const dispatch = createEventDispatcher();

    // Handle form submission
    async function handleSubmit() {
        error = "";

        // Validate passwords match
        if (password !== confirmPassword) {
            error = "Passwords do not match";
            return;
        }

        isSubmitting = true;

        try {
            const success = await register(email, password, displayName);

            if (success) {
                dispatch("success");

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

<div class="card register-form">
    <h2>Create Account</h2>

    {#if error}
        <div class="alert alert-error">
            <svg
                xmlns="http://www.w3.org/2000/svg"
                class="alert-icon"
                viewBox="0 0 20 20"
                fill="currentColor"
            >
                <path
                    fill-rule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clip-rule="evenodd"
                />
            </svg>
            <span>{error}</span>
        </div>
    {/if}

    <form on:submit|preventDefault={handleSubmit}>
        <div class="input-wrapper mb-4">
            <label for="displayName">Name</label>
            <input
                type="text"
                id="displayName"
                class="input"
                bind:value={displayName}
                placeholder="Enter your name"
                required
                disabled={isSubmitting}
            />
        </div>

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

        <div class="input-wrapper mb-4">
            <label for="password">Password</label>
            <input
                type="password"
                id="password"
                class="input"
                bind:value={password}
                placeholder="Create a password"
                required
                minlength="6"
                disabled={isSubmitting}
            />
        </div>

        <div class="input-wrapper mb-6">
            <label for="confirmPassword">Confirm Password</label>
            <input
                type="password"
                id="confirmPassword"
                class="input"
                bind:value={confirmPassword}
                placeholder="Confirm your password"
                required
                minlength="6"
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
                    <span>Creating Account...</span>
                {:else}
                    <span>Create Account</span>
                {/if}
            </button>
        </div>

        <div class="auth-links">
            <span>Already have an account?</span>
            <a href="/auth/login" class="auth-link">Sign In</a>
        </div>
    </form>
</div>

<style>
    .register-form {
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

    .auth-links {
        display: flex;
        justify-content: center;
        gap: var(--space-2);
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
