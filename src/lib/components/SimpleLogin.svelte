<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { sessionToken as sessionTokenStore } from '$lib/store';

  const dispatch = createEventDispatcher();

  let email = '';
  let password = '';
  let confirmPassword = '';
  let name = '';
  let isLoading = false;
  let error = '';
  let success = '';
  let isAuthenticated = false;
  let user: any = null;
  let mode: 'login' | 'signup' | 'forgot' = 'login';

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

    if (!password) {
      error = 'Please enter your password';
      return;
    }

    isLoading = true;
    error = '';
    success = '';

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

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

  async function handleSignup() {
    if (!email || !email.includes('@')) {
      error = 'Please enter a valid email address';
      return;
    }

    if (!password || password.length < 8) {
      error = 'Password must be at least 8 characters';
      return;
    }

    if (password !== confirmPassword) {
      error = 'Passwords do not match';
      return;
    }

    isLoading = true;
    error = '';
    success = '';

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, name: name || undefined })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Signup failed');
      }

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
        error = data.error || 'Signup failed';
      }
    } catch (err) {
      console.error('Signup error:', err);
      error = err instanceof Error ? err.message : 'Signup failed';
    } finally {
      isLoading = false;
    }
  }

  async function handleForgotPassword() {
    if (!email || !email.includes('@')) {
      error = 'Please enter a valid email address';
      return;
    }

    isLoading = true;
    error = '';
    success = '';

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email');
      }

      success = data.message || 'Password reset link sent! Check your email.';
      email = '';
    } catch (err) {
      console.error('Forgot password error:', err);
      error = err instanceof Error ? err.message : 'Failed to send reset email';
    } finally {
      isLoading = false;
    }
  }

  function switchMode(newMode: 'login' | 'signup' | 'forgot') {
    mode = newMode;
    error = '';
    success = '';
    password = '';
    confirmPassword = '';
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
      <!-- Mode Tabs -->
      <div class="tabs tabs-boxed mb-6">
        <button
          class="tab {mode === 'login' ? 'tab-active' : ''}"
          on:click={() => switchMode('login')}
        >
          Login
        </button>
        <button
          class="tab {mode === 'signup' ? 'tab-active' : ''}"
          on:click={() => switchMode('signup')}
        >
          Sign Up
        </button>
      </div>

      <!-- Login Form -->
      {#if mode === 'login'}
        <h2 class="text-2xl font-bold mb-4">Welcome Back</h2>
        <p class="text-sm text-base-content/70 mb-6">Sign in to your account</p>

        <form on:submit|preventDefault={handleLogin} class="w-full max-w-xs">
          <div class="form-control w-full mb-4">
            <input
              type="email"
              placeholder="Email"
              bind:value={email}
              class="input input-bordered w-full"
              disabled={isLoading}
              required
            />
          </div>

          <div class="form-control w-full mb-4">
            <input
              type="password"
              placeholder="Password"
              bind:value={password}
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

          <button type="submit" class="btn btn-primary btn-wide mb-2" disabled={isLoading}>
            {#if isLoading}
              <span class="loading loading-spinner"></span>
              Signing in...
            {:else}
              Sign In
            {/if}
          </button>

          <button
            type="button"
            class="btn btn-ghost btn-sm"
            on:click={() => switchMode('forgot')}
          >
            Forgot Password?
          </button>
        </form>

      <!-- Signup Form -->
      {:else if mode === 'signup'}
        <h2 class="text-2xl font-bold mb-4">Create Account</h2>
        <p class="text-sm text-base-content/70 mb-6">Sign up to get started</p>

        <form on:submit|preventDefault={handleSignup} class="w-full max-w-xs">
          <div class="form-control w-full mb-4">
            <input
              type="text"
              placeholder="Name (optional)"
              bind:value={name}
              class="input input-bordered w-full"
              disabled={isLoading}
            />
          </div>

          <div class="form-control w-full mb-4">
            <input
              type="email"
              placeholder="Email"
              bind:value={email}
              class="input input-bordered w-full"
              disabled={isLoading}
              required
            />
          </div>

          <div class="form-control w-full mb-4">
            <input
              type="password"
              placeholder="Password (min 8 characters)"
              bind:value={password}
              class="input input-bordered w-full"
              disabled={isLoading}
              required
            />
          </div>

          <div class="form-control w-full mb-4">
            <input
              type="password"
              placeholder="Confirm Password"
              bind:value={confirmPassword}
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
              Creating account...
            {:else}
              Create Account
            {/if}
          </button>
        </form>

      <!-- Forgot Password Form -->
      {:else if mode === 'forgot'}
        <h2 class="text-2xl font-bold mb-4">Reset Password</h2>
        <p class="text-sm text-base-content/70 mb-6">Enter your email to receive a reset link</p>

        <form on:submit|preventDefault={handleForgotPassword} class="w-full max-w-xs">
          <div class="form-control w-full mb-4">
            <input
              type="email"
              placeholder="Email"
              bind:value={email}
              class="input input-bordered w-full"
              disabled={isLoading}
              required
            />
          </div>

          {#if success}
            <div class="alert alert-success mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-sm">{success}</span>
            </div>
          {/if}

          {#if error}
            <div class="alert alert-error mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-sm">{error}</span>
            </div>
          {/if}

          <button type="submit" class="btn btn-primary btn-wide mb-2" disabled={isLoading}>
            {#if isLoading}
              <span class="loading loading-spinner"></span>
              Sending...
            {:else}
              Send Reset Link
            {/if}
          </button>

          <button
            type="button"
            class="btn btn-ghost btn-sm"
            on:click={() => switchMode('login')}
          >
            Back to Login
          </button>
        </form>
      {/if}
    </div>
  </div>
{/if}
