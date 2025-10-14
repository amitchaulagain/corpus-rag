<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { sessionToken as sessionTokenStore } from '$lib/store';

  const dispatch = createEventDispatcher();

  let email = '';
  let isLoading = false;
  let error = '';
  let isAuthenticated = false;
  let user: any = null;

  onMount(async () => {
    if (!browser) return;

    // Check if we have a stored session token
    const storedToken = localStorage.getItem('session_token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      console.log('Found stored session');
      try {
        user = JSON.parse(storedUser);
        isAuthenticated = true;
        sessionTokenStore.set(storedToken);
        dispatch('authenticated', { user, token: storedToken });
      } catch (e) {
        console.error('Failed to parse stored user:', e);
        localStorage.removeItem('session_token');
        localStorage.removeItem('user');
      }
    }
  });

  async function handleLogin() {
    if (!email || !email.includes('@')) {
      error = 'Please enter a valid email address';
      return;
    }

    isLoading = true;
    error = '';

    try {
      // Simple email-based login - create JWT directly
      const response = await fetch('/api/auth/email-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Login failed');
      }

      const data = await response.json();

      if (data.success && data.token) {
        // Store session token and user data
        localStorage.setItem('session_token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        user = data.user;
        isAuthenticated = true;
        sessionTokenStore.set(data.token);

        dispatch('authenticated', { user: data.user, token: data.token });

        // Redirect to dashboard
        goto('/dashboard');
      } else {
        error = data.error || 'Login failed';
      }
    } catch (err) {
      console.error('Login error:', err);
      error = err instanceof Error ? err.message : 'Login failed';
    } finally {
      isLoading = false;
    }
  }

  async function logout() {
    if (!browser) return;

    const token = localStorage.getItem('session_token');

    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }

    localStorage.removeItem('session_token');
    localStorage.removeItem('user');
    sessionTokenStore.set(null);
    isAuthenticated = false;
    user = null;
    dispatch('logout');
  }
</script>

{#if !browser}
  <div class="text-center py-12">
    <span class="loading loading-spinner loading-lg text-primary"></span>
  </div>
{:else if isAuthenticated && user}
  <div class="card bg-base-100 shadow-2xl border border-base-300">
    <div class="card-body">
      <div class="flex flex-col items-center gap-4 text-center">
        <div class="avatar placeholder">
          <div class="bg-primary text-primary-content rounded-full w-16">
            <span class="text-2xl">{user.name?.charAt(0) || user.email?.charAt(0) || '?'}</span>
          </div>
        </div>
        <div>
          <h3 class="text-xl font-bold">Welcome, {user.name || user.email}!</h3>
          <p class="text-base-content/70">{user.email}</p>
          <span class="badge badge-primary mt-2">{user.userType}</span>
        </div>
        <button class="btn btn-error btn-wide mt-4" on:click={logout}>
          Logout
        </button>
      </div>
    </div>
  </div>
{:else}
  <div class="card bg-base-100 shadow-2xl border border-base-300">
    <div class="card-body items-center text-center py-12">
      <h2 class="text-2xl font-bold mb-4">Administrator Sign In</h2>
      <p class="text-sm text-base-content/70 mb-6">Enter your email to access the admin panel</p>

      <form on:submit|preventDefault={handleLogin} class="w-full max-w-xs">
        <div class="form-control w-full mb-4">
          <input
            type="email"
            placeholder="admin@example.com"
            bind:value={email}
            class="input input-bordered w-full"
            disabled={isLoading}
            required
          />
        </div>

        {#if error}
          <div class="alert alert-error mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="text-sm">{error}</span>
          </div>
        {/if}

        <button type="submit" class="btn btn-primary btn-wide" disabled={isLoading}>
          {#if isLoading}
            <span class="loading loading-spinner"></span>
            Signing in...
          {:else}
            Sign In
          {/if}
        </button>
      </form>
    </div>
  </div>
{/if}
