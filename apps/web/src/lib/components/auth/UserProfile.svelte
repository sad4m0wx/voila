<script>
    import {
        authStore,
        logout,
        savedAddresses,
        setHomeAddress,
    } from "$lib/stores/auth";

    // State
    let isLoggingOut = false;
    let error = "";

    // Handle logout
    async function handleLogout() {
        isLoggingOut = true;
        error = "";

        try {
            await logout();
        } catch (err) {
            error = err.message;
        } finally {
            isLoggingOut = false;
        }
    }

    // Handle setting home address
    async function handleSetHomeAddress(address) {
        try {
            await setHomeAddress(address);
        } catch (err) {
            error = err.message;
        }
    }
</script>

<div class="user-profile">
    {#if $authStore.user}
        <div class="profile-header">
            <div class="avatar">
                {#if $authStore.user.photoURL}
                    <img
                        src={$authStore.user.photoURL}
                        alt={$authStore.user.displayName || "User"}
                    />
                {:else}
                    <div class="avatar-placeholder">
                        {($authStore.user.displayName ||
                            "User")[0].toUpperCase()}
                    </div>
                {/if}
            </div>

            <div class="user-info">
                <h3 class="user-name">
                    {$authStore.user.displayName || "User"}
                    {#if $authStore.user.isAnonymous}
                        <span class="guest-badge">Guest</span>
                    {/if}
                </h3>
                <p class="user-email">
                    {$authStore.user.email || "Anonymous User"}
                </p>
            </div>

            <button
                class="btn btn-outline btn-sm"
                on:click={handleLogout}
                disabled={isLoggingOut}
            >
                {#if isLoggingOut}
                    <span class="loader loader-sm"></span>
                {:else}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
                        ></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    <span>Sign Out</span>
                {/if}
            </button>
        </div>

        {#if error}
            <div class="alert alert-error mt-4">
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

        {#if $authStore.user.isAnonymous}
            <div class="account-upgrade">
                <p>
                    You're using a temporary guest account. Your data will be
                    lost when you sign out.
                </p>
                <a href="/auth/upgrade" class="btn btn-primary btn-sm">
                    Upgrade to Full Account
                </a>
            </div>
        {/if}

        <div class="addresses-section">
            <h4>Your Addresses</h4>

            {#if $savedAddresses.length === 0}
                <p class="no-addresses">No saved addresses yet.</p>
            {:else}
                <ul class="address-list">
                    {#each $savedAddresses as address}
                        <li class="address-item">
                            <div class="address-info">
                                <span class="address-name">{address.name}</span>
                                <span class="address-value"
                                    >{address.value}</span
                                >
                            </div>

                            <div class="address-actions">
                                {#if !address.isHome}
                                    <button
                                        class="btn btn-sm btn-outline"
                                        on:click={() =>
                                            handleSetHomeAddress(address)}
                                    >
                                        Set as Home
                                    </button>
                                {:else}
                                    <span class="home-badge">Home</span>
                                {/if}
                            </div>
                        </li>
                    {/each}
                </ul>
            {/if}
        </div>
    {:else if $authStore.isLoading}
        <div class="loading">
            <div class="loader"></div>
            <p>Loading profile...</p>
        </div>
    {:else}
        <div class="not-signed-in">
            <p>You are not signed in.</p>
            <div class="auth-buttons">
                <a href="/auth/login" class="btn btn-primary">Sign In</a>
                <a href="/auth/register" class="btn btn-outline"
                    >Create Account</a
                >
            </div>
        </div>
    {/if}
</div>

<style>
    .user-profile {
        max-width: 600px;
        margin: 0 auto;
    }

    .profile-header {
        display: flex;
        align-items: center;
        gap: var(--space-4);
        margin-bottom: var(--space-6);
    }

    .avatar {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        overflow: hidden;
    }

    .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .avatar-placeholder {
        width: 100%;
        height: 100%;
        background-color: var(--primary-100);
        color: var(--primary-700);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        font-weight: var(--font-semibold);
    }

    .user-info {
        flex: 1;
    }

    .user-name {
        margin: 0;
        font-size: var(--text-xl);
        display: flex;
        align-items: center;
        gap: var(--space-2);
    }

    .guest-badge {
        background-color: var(--neutral-100);
        color: var(--neutral-600);
        padding: 0.125rem 0.5rem;
        border-radius: var(--radius-full);
        font-size: var(--text-xs);
        font-weight: var(--font-medium);
    }

    .user-email {
        margin: 0;
        color: var(--text-secondary);
        font-size: var(--text-sm);
    }

    .account-upgrade {
        background-color: var(--bg-subtle);
        border-radius: var(--radius-md);
        padding: var(--space-4);
        margin-bottom: var(--space-6);
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
    }

    .account-upgrade p {
        margin: 0;
        font-size: var(--text-sm);
    }

    .addresses-section {
        margin-top: var(--space-6);
    }

    .addresses-section h4 {
        margin-bottom: var(--space-4);
        padding-bottom: var(--space-2);
        border-bottom: 1px solid var(--neutral-200);
    }

    .no-addresses {
        color: var(--text-tertiary);
        font-style: italic;
    }

    .address-list {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .address-item {
        padding: var(--space-3) 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid var(--neutral-100);
    }

    .address-info {
        display: flex;
        flex-direction: column;
    }

    .address-name {
        font-weight: var(--font-medium);
    }

    .address-value {
        font-size: var(--text-sm);
        color: var(--text-secondary);
        margin-top: var(--space-1);
    }

    .home-badge {
        display: inline-flex;
        align-items: center;
        background-color: var(--primary-100);
        color: var(--primary-700);
        padding: 0.25rem 0.75rem;
        border-radius: var(--radius-full);
        font-size: var(--text-xs);
        font-weight: var(--font-medium);
    }

    .loading,
    .not-signed-in {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--space-8) 0;
    }

    .auth-buttons {
        display: flex;
        gap: var(--space-4);
        margin-top: var(--space-4);
    }
</style>
