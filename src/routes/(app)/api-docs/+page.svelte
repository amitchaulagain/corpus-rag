<script>
  import { onMount } from 'svelte';
  import { sessionToken } from '$lib/store';

  let token = '';
  sessionToken.subscribe(value => {
    token = value || '';
  });

  onMount(() => {
    const script1 = document.createElement('script');
    script1.src = '/swagger-ui/swagger-ui-bundle.js';
    script1.onload = () => {
      const script2 = document.createElement('script');
      script2.src = '/swagger-ui/swagger-ui-standalone-preset.js';
      script2.onload = () => {
        const ui = SwaggerUIBundle({
          url: "/api/swagger.json",
          dom_id: '#swagger-ui',
          presets: [
            SwaggerUIBundle.presets.apis,
            SwaggerUIStandalonePreset
          ],
          layout: "StandaloneLayout"
        });
      };
      document.head.appendChild(script2);
    };
    document.head.appendChild(script1);
  });
</script>

<svelte:head>
  <title>API Docs</title>
  <link rel="stylesheet" type="text/css" href="/swagger-ui/swagger-ui.css" />
</svelte:head>

<div class="container mx-auto p-4">
  <h1 class="text-3xl font-bold mb-4">API Documentation</h1>

  <div class="card bg-base-200 shadow-xl mb-6">
    <div class="card-body">
      <h2 class="card-title">Authentication Token</h2>
      <p>Use the following token to authenticate your API requests. This is your session token.</p>
      <div class="form-control">
        <input type="text" readonly bind:value={token} class="input input-bordered w-full" />
      </div>
      <p class="text-sm mt-2">Click the "Authorize" button below and paste this token into the "BearerAuth" field in the format `Bearer {token}`.</p>
    </div>
  </div>

  <div id="swagger-ui"></div>
</div>