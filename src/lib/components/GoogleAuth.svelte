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
  <div class="text-center py-12">
    <span class="loading loading-spinner loading-lg text-primary"></span>
  </div>
{:else if isLoading}
  <div class="text-center py-12">
    <span class="loading loading-spinner loading-lg text-primary"></span>
    <p class="mt-4 text-base-content/70">Checking authentication...</p>
  </div>
{:else if isAuthenticated && user}
  <div class="card bg-base-100 shadow-2xl border border-base-300">
    <div class="card-body">
      <div class="flex flex-col items-center gap-4 text-center">
        <div class="avatar">
          <div class="w-16 rounded-full ring ring-primary ring-offset-2">
            {#if user.picture}
              <img src={user.picture} alt={user.name} />
            {:else}
              <div class="bg-primary text-primary-content flex items-center justify-center text-2xl font-bold">
                {user.name?.charAt(0) || user.email?.charAt(0) || '?'}
              </div>
            {/if}
          </div>
        </div>
        <div>
          <h3 class="text-xl font-bold">Welcome, {user.name}!</h3>
          <p class="text-base-content/70">{user.email}</p>
          <span class="badge badge-primary mt-2">{user.userType}</span>
        </div>
        <button class="btn btn-error btn-wide mt-4" on:click={logout}>
          🚪 Logout
        </button>
      </div>
    </div>
  </div>
{:else}
  <div class="card bg-base-100 shadow-2xl border border-base-300">
    <div class="card-body items-center text-center py-12">
      <h2 class="text-2xl font-bold mb-8">Administrator Sign In</h2>
      <div id="google-signin-button" class="flex justify-center"></div>
    </div>
  </div>
{/if}
