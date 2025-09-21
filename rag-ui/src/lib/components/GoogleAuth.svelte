<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

  const dispatch = createEventDispatcher();

  let isAuthenticated = false;
  let user: any = null;
  let isLoading = true;

  import { browser } from '$app/environment';

  // Get these from environment variables
  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'your-client-id-here';
  let REDIRECT_URI = '';
  const SCOPES = [
    'openid',
    'profile',
    'email'
  ].join(' ');

  onMount(async () => {
    if (!browser) return;

    REDIRECT_URI = window.location.origin;

    // Check if we have a stored access token
    const storedToken = localStorage.getItem('google_access_token');
    const storedUser = localStorage.getItem('google_user');

    if (storedToken && storedUser) {
      try {
        // Verify token is still valid
        const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${storedToken}`);
        if (response.ok) {
          user = JSON.parse(storedUser);
          isAuthenticated = true;
          dispatch('authenticated', { user, token: storedToken });
        } else {
          // Token expired, clear storage
          localStorage.removeItem('google_access_token');
          localStorage.removeItem('google_user');
        }
      } catch (error) {
        console.error('Token validation error:', error);
        localStorage.removeItem('google_access_token');
        localStorage.removeItem('google_user');
      }
    }

    // Check for authorization code in URL (OAuth callback)
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code && !isAuthenticated) {
      await handleAuthCode(code);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    isLoading = false;
  });

  async function handleAuthCode(code: string) {
    try {
      isLoading = true;

      // Exchange code for access token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET || 'your-client-secret-here',
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: REDIRECT_URI,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.access_token) {
        // Get user info
        const userResponse = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${tokenData.access_token}`);
        const userData = await userResponse.json();

        // Store tokens and user data
        localStorage.setItem('google_access_token', tokenData.access_token);
        localStorage.setItem('google_user', JSON.stringify(userData));

        user = userData;
        isAuthenticated = true;

        dispatch('authenticated', { user: userData, token: tokenData.access_token });
      } else {
        console.error('Failed to get access token:', tokenData);
      }
    } catch (error) {
      console.error('Auth code exchange failed:', error);
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
  <div class="auth-container loading">
    <div class="spinner"></div>
    <p>Loading...</p>
  </div>
{:else if isLoading}
  <div class="auth-container loading">
    <div class="spinner"></div>
    <p>Checking authentication...</p>
  </div>
{:else if isAuthenticated && user}
  <div class="auth-container authenticated">
    <div class="user-info">
      <img src={user.picture} alt={user.name} class="user-avatar" />
      <div class="user-details">
        <h3>Welcome, {user.name}!</h3>
        <p class="user-email">{user.email}</p>
      </div>
    </div>
    <button class="btn logout-btn" on:click={logout}>
      🚪 Logout
    </button>
  </div>
{:else}
  <div class="auth-container unauthenticated">
    <div class="login-prompt">
      <h2>🔐 Authentication Required</h2>
      <p>Please log in with your Google account to access the RAG system.</p>
      <p class="security-note">Your files will be stored securely in your own isolated folder.</p>

      <button class="btn login-btn" on:click={startOAuthFlow}>
        <svg class="google-icon" viewBox="0 0 24 24">
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

<style>
  .auth-container {
    margin-bottom: 30px;
    padding: 30px;
    border: 1px solid #e1e5e9;
    border-radius: 12px;
    background: #f8f9fa;
  }

  .auth-container.loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 15px;
    color: #666;
  }

  .auth-container.authenticated {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: linear-gradient(135deg, #e8f5e8 0%, #f0f8f0 100%);
    border-color: #28a745;
  }

  .auth-container.unauthenticated {
    text-align: center;
    background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
    border-color: #ffc107;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .user-avatar {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    border: 2px solid #28a745;
  }

  .user-details h3 {
    margin: 0 0 5px 0;
    color: #155724;
    font-weight: 600;
  }

  .user-email {
    margin: 0;
    color: #155724;
    opacity: 0.8;
    font-size: 14px;
  }

  .login-prompt h2 {
    color: #856404;
    margin-bottom: 15px;
    font-size: 1.5rem;
  }

  .login-prompt p {
    color: #856404;
    margin-bottom: 15px;
  }

  .security-note {
    font-size: 14px;
    opacity: 0.8;
    margin-bottom: 25px !important;
  }

  .btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }

  .btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
  }

  .login-btn {
    background: #4285f4;
    background: linear-gradient(135deg, #4285f4 0%, #34a853 100%);
    font-size: 18px;
    padding: 15px 30px;
  }

  .logout-btn {
    background: #dc3545;
    background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
    padding: 10px 20px;
    font-size: 14px;
  }

  .google-icon {
    width: 20px;
    height: 20px;
  }

  .spinner {
    border: 3px solid #f3f3f3;
    border-top: 3px solid #667eea;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>