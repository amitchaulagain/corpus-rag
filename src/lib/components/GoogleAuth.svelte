<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';

  const dispatch = createEventDispatcher();

  let isAuthenticated = false;
  let user: any = null;
  let isLoading = true;
  let google: any = null;

  const CLIENT_ID = PUBLIC_GOOGLE_CLIENT_ID;

  onMount(async () => {
    if (!browser) return;

    // Check if we have a stored session token
    const storedToken = localStorage.getItem('session_token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      console.log('📱 Found stored session, validating...');
      try {
        // Verify session token with backend
        const response = await fetch('/api/auth/verify', {
          headers: {
            'Authorization': `Bearer ${storedToken}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            user = data.user;
            isAuthenticated = true;
            console.log('✅ Session valid, user authenticated:', user.email);
            dispatch('authenticated', { user, token: storedToken });
          } else {
            console.log('❌ Session expired, clearing storage');
            localStorage.removeItem('session_token');
            localStorage.removeItem('user');
          }
        } else {
          console.log('❌ Session validation failed');
          localStorage.removeItem('session_token');
          localStorage.removeItem('user');
        }
      } catch (error) {
        console.error('❌ Session validation error:', error);
        localStorage.removeItem('session_token');
        localStorage.removeItem('user');
      }
    }

    // Load Google Sign-In library
    if (!isAuthenticated) {
      loadGoogleSignIn();
    }

    isLoading = false;
  });

  function loadGoogleSignIn() {
    // Load Google Sign-In script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogleSignIn;
    document.head.appendChild(script);
  }

  function initializeGoogleSignIn() {
    if (!window.google) return;

    google = window.google;

    // Initialize Google Sign-In
    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: handleGoogleCallback
    });

    // Render the button
    google.accounts.id.renderButton(
      document.getElementById('google-signin-button'),
      {
        theme: 'outline',
        size: 'large',
        width: 300,
        text: 'signin_with'
      }
    );
  }

  async function handleGoogleCallback(response: any) {
    if (!response.credential) {
      console.error('No credential in response');
      return;
    }

    isLoading = true;

    try {
      // Send the credential to our backend (using JSON storage)
      const loginResponse = await fetch('/api/auth/login-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          credential: response.credential
        })
      });

      const loginData = await loginResponse.json();

      if (loginData.success && loginData.token) {
        // Store session token and user data
        localStorage.setItem('session_token', loginData.token);
        localStorage.setItem('user', JSON.stringify(loginData.user));

        user = loginData.user;
        isAuthenticated = true;

        dispatch('authenticated', { user: loginData.user, token: loginData.token });

        // Redirect to dashboard
        goto('/dashboard');
      } else {
        console.error('Login failed:', loginData);
        alert('Login failed: ' + (loginData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
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
    isAuthenticated = false;
    user = null;
    dispatch('logout');
  }
</script>

{#if !browser}
  <div class="card bg-base-100 shadow-xl p-8 text-center">
    <span class="loading loading-spinner loading-lg text-primary"></span>
    <p class="mt-4 text-base-content/70">Loading...</p>
  </div>
{:else if isLoading}
  <div class="card bg-base-100 shadow-xl p-8 text-center">
    <span class="loading loading-spinner loading-lg text-primary"></span>
    <p class="mt-4 text-base-content/70">Checking authentication...</p>
  </div>
{:else if isAuthenticated && user}
  <div class="card bg-success/20 border-2 border-success shadow-xl">
    <div class="card-body">
      <div class="flex flex-col lg:flex-row justify-between items-center gap-4">
        <div class="flex items-center gap-4">
          <div class="avatar">
            <div class="w-12 rounded-full ring ring-success ring-offset-2">
              {#if user.picture}
                <img src={user.picture} alt={user.name} />
              {:else}
                <div class="bg-primary text-primary-content flex items-center justify-center text-xl font-bold">
                  {user.name?.charAt(0) || user.email?.charAt(0) || '?'}
                </div>
              {/if}
            </div>
          </div>
          <div>
            <h3 class="font-bold text-success-content">Welcome, {user.name}!</h3>
            <p class="text-success-content/70 text-sm">{user.email}</p>
            <div class="flex gap-2 mt-1">
              <span class="badge badge-sm {user.userType === 'admin' ? 'badge-error' : user.userType === 'premium' ? 'badge-warning' : 'badge-info'}">
                {user.userType}
              </span>
              {#if user.isPaid}
                <span class="badge badge-sm badge-success">Paid</span>
              {/if}
            </div>
          </div>
        </div>
        <button class="btn btn-error btn-sm" on:click={logout}>
          🚪 Logout
        </button>
      </div>
    </div>
  </div>
{:else}
  <div class="card bg-base-100 shadow-xl">
    <div class="card-body text-center">
      <h2 class="text-2xl font-bold mb-4">Sign in to continue</h2>
      <div id="google-signin-button" class="flex justify-center"></div>
    </div>
  </div>
{/if}
