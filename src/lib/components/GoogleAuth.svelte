<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

  const dispatch = createEventDispatcher();

  let isAuthenticated = false;
  let user: any = null;
  let isLoading = true;

  import { browser } from '$app/environment';

  import { PUBLIC_GOOGLE_CLIENT_ID } from '$env/static/public';

  // Get these from environment variables
  const CLIENT_ID = PUBLIC_GOOGLE_CLIENT_ID;
  let REDIRECT_URI = '';
  const SCOPES = [
    'openid',
    'profile',
    'email'
  ].join(' ');

  onMount(async () => {
    if (!browser) return;

    REDIRECT_URI = window.location.origin;
    console.log('🔐 GoogleAuth initialized, redirect URI:', REDIRECT_URI);

    // Check if we have a stored access token
    const storedToken = localStorage.getItem('google_access_token');
    const storedUser = localStorage.getItem('google_user');

    if (storedToken && storedUser) {
      console.log('📱 Found stored credentials, validating...');
      try {
        // Verify token is still valid
        const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${storedToken}`);
        if (response.ok) {
          user = JSON.parse(storedUser);
          isAuthenticated = true;
          console.log('✅ Stored token is valid, user authenticated:', user.email);
          dispatch('authenticated', { user, token: storedToken });
        } else {
          console.log('❌ Stored token expired, clearing storage');
          // Token expired, clear storage
          localStorage.removeItem('google_access_token');
          localStorage.removeItem('google_user');
        }
      } catch (error) {
        console.error('❌ Token validation error:', error);
        localStorage.removeItem('google_access_token');
        localStorage.removeItem('google_user');
      }
    }

    // Check for authorization code in URL (OAuth callback)
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    console.log('🔍 Checking URL for OAuth code...');
    console.log('URL params:', window.location.search);
    console.log('OAuth code found:', code ? 'YES' : 'NO');

    if (code && !isAuthenticated) {
      console.log('🚀 Processing OAuth code:', code.substring(0, 20) + '...');
      await handleAuthCode(code);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    isLoading = false;
  });

  async function handleAuthCode(code: string) {
    try {
      isLoading = true;

      // Exchange code for access token via our backend API
      const tokenResponse = await fetch('/api/auth/exchange-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code,
          redirect_uri: REDIRECT_URI
        }),
      });

      const tokenData = await tokenResponse.json();
      console.log('Token exchange response:', tokenData);

      if (tokenData.success && tokenData.data?.access_token) {
        // Store tokens and user data
        localStorage.setItem('google_access_token', tokenData.data.access_token);
        localStorage.setItem('google_user', JSON.stringify(tokenData.data.user));

        user = tokenData.data.user;
        isAuthenticated = true;

        dispatch('authenticated', { user: tokenData.data.user, token: tokenData.data.access_token });
      } else {
        console.error('Failed to get access token:', tokenData);
        alert('Login failed: ' + (tokenData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Auth code exchange failed:', error);
      alert('Login failed: ' + error.message);
    } finally {
      isLoading = false;
    }
  }

  function startOAuthFlow() {
    if (!browser) return;

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', SCOPES);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');

    window.location.href = authUrl.toString();
  }

  function logout() {
    if (!browser) return;

    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_user');
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
              <img src={user.picture} alt={user.name} />
            </div>
          </div>
          <div>
            <h3 class="font-bold text-success-content">Welcome, {user.name}!</h3>
            <p class="text-success-content/70 text-sm">{user.email}</p>
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
      <button class="btn btn-primary btn-lg" on:click={startOAuthFlow}>
        <svg class="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign in with Google
      </button>
    </div>
  </div>
{/if}

