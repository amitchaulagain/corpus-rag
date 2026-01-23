<script lang="ts">
  import { onMount } from 'svelte';
  import { sessionToken } from '$lib/store';

  let token = '';
  let user: any = null;
  let jwtToken = '';
  let copyButtonText = 'Copy JWT';

  sessionToken.subscribe(value => {
    token = value || '';
  });

  // Load user info and fetch JWT for admin
  onMount(async () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        user = JSON.parse(storedUser);
      } catch (e) {
        console.error('Failed to parse user data:', e);
      }
    }

    // Only fetch JWT if admin
    if (user?.userType === 'admin') {
      await getJwtToken();
    }

    initSwaggerUI();
  });

  async function getJwtToken() {
    if (!user || !user.email) return;

    try {
      const response = await fetch('/api/auth/session-to-jwt', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.accessToken) {
          jwtToken = data.accessToken;
        }
      } else {
        console.error('Failed to get JWT token', await response.json());
      }
    } catch (error) {
      console.error('Failed to get JWT token:', error);
    }
  }

  function copyJwtToken() {
    navigator.clipboard.writeText(jwtToken);
    copyButtonText = 'Copied!';
    setTimeout(() => copyButtonText = 'Copy JWT', 2000);
  }

  function initSwaggerUI() {
    const script1 = document.createElement('script');
    script1.src = '/swagger-ui/swagger-ui-bundle.js';
    script1.onload = () => {
      const script2 = document.createElement('script');
      script2.src = '/swagger-ui/swagger-ui-standalone-preset.js';
      script2.onload = () => {
        // Initialize SwaggerUI
        const ui = SwaggerUIBundle({
          url: "/api/swagger.json",
          dom_id: '#swagger-ui',
          presets: [
            SwaggerUIBundle.presets.apis,
            SwaggerUIStandalonePreset
          ],
          layout: "StandaloneLayout",
          requestInterceptor: (req) => {
            // Auto-inject JWT for admin user
            if (jwtToken) {
              req.headers['Authorization'] = 'Bearer ' + jwtToken;
            }
            return req;
          }
        });
      };
      document.head.appendChild(script2);
    };
    document.head.appendChild(script1);
  }
</script>

<svelte:head>
  <title>API Docs</title>
  <link rel="stylesheet" type="text/css" href="/swagger-ui/swagger-ui.css" />
  <!-- Your dark mode styles here (unchanged) -->
</svelte:head>

<div class="container mx-auto max-w-7xl api-docs-container">
  <h1 class="text-3xl font-bold mb-4">🚀 API Documentation</h1>

  {#if user}
    <div class="card bg-base-200 shadow-xl mb-6">
      <div class="card-body">
        <h2 class="card-title">🔑 Your JWT Access Token</h2>
        <div class="alert alert-success mb-4">
          <div>
            <h3 class="font-bold">✅ Use this for API Testing</h3>
            <div class="text-sm">
              This JWT token authenticates you in the API. Valid for 15 minutes.
              <br />
              <strong>User:</strong> {user.email} ({user.userType})
            </div>
          </div>
        </div>
        {#if jwtToken}
          <div class="flex gap-2">
            <input type="text" readonly bind:value={jwtToken} class="input input-bordered w-full font-mono text-xs" />
            <button class="btn btn-primary" on:click={copyJwtToken}>{copyButtonText}</button>
          </div>
        {:else}
          <div class="flex gap-2 items-center">
            <span class="loading loading-spinner loading-sm"></span>
            <span class="text-sm">Getting JWT token...</span>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="alert alert-warning mb-6">
      Loading user information...
    </div>
  {/if}

  <div id="swagger-ui"></div>
</div>
