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

  onMount(() => {
    // Get user info from localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        user = JSON.parse(storedUser);
      } catch (e) {
        console.error('Failed to parse user data:', e);
      }
    }

    // Get JWT token for API testing
    getJwtToken();
  });

  async function getJwtToken() {
    if (!user || !user.email) return;

    try {
      // Create JWT for current user
      const response = await fetch('/api/auth/session-to-jwt', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.accessToken) {
          jwtToken = data.accessToken;
        }
      }
    } catch (error) {
      console.error('Failed to get JWT token:', error);
    }
  }

  function copyJwtToken() {
    navigator.clipboard.writeText(jwtToken);
    copyButtonText = 'Copied!';
    setTimeout(() => {
      copyButtonText = 'Copy JWT';
    }, 2000);
  }

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
  <style>
    /* Dark mode overrides for Swagger UI */
    [data-theme="dark"] .swagger-ui {
      /* Main backgrounds */
      background: #0a0a0a !important;
      color: #ffffff !important;
    }

    /* Information section */
    [data-theme="dark"] .swagger-ui .info {
      background: #0a0a0a !important;
    }

    [data-theme="dark"] .swagger-ui .info .title,
    [data-theme="dark"] .swagger-ui .info h1,
    [data-theme="dark"] .swagger-ui .info h2,
    [data-theme="dark"] .swagger-ui .info h3,
    [data-theme="dark"] .swagger-ui .info h4,
    [data-theme="dark"] .swagger-ui .info h5 {
      color: #ffffff !important;
    }

    [data-theme="dark"] .swagger-ui .info .description,
    [data-theme="dark"] .swagger-ui .info p,
    [data-theme="dark"] .swagger-ui .info .markdown p {
      color: #e0e0e0 !important;
    }

    /* Operation blocks */
    [data-theme="dark"] .swagger-ui .opblock {
      background: #1a1a1a !important;
      border: 1px solid #333 !important;
    }

    [data-theme="dark"] .swagger-ui .opblock .opblock-summary {
      background: #1a1a1a !important;
      border-bottom: 1px solid #333 !important;
    }

    [data-theme="dark"] .swagger-ui .opblock.opblock-post {
      background: #1a1a1a !important;
      border-color: #49cc90 !important;
    }

    [data-theme="dark"] .swagger-ui .opblock.opblock-get {
      background: #1a1a1a !important;
      border-color: #61affe !important;
    }

    [data-theme="dark"] .swagger-ui .opblock.opblock-put {
      background: #1a1a1a !important;
      border-color: #fca130 !important;
    }

    [data-theme="dark"] .swagger-ui .opblock.opblock-delete {
      background: #1a1a1a !important;
      border-color: #f93e3e !important;
    }

    /* Operation summary text */
    [data-theme="dark"] .swagger-ui .opblock .opblock-summary-description,
    [data-theme="dark"] .swagger-ui .opblock .opblock-summary-path,
    [data-theme="dark"] .swagger-ui .opblock-description-wrapper p,
    [data-theme="dark"] .swagger-ui .opblock .opblock-section-header h4 {
      color: #ffffff !important;
    }

    /* Tables */
    [data-theme="dark"] .swagger-ui table {
      background: #1a1a1a !important;
    }

    [data-theme="dark"] .swagger-ui table thead tr th,
    [data-theme="dark"] .swagger-ui table thead tr td {
      background: #0a0a0a !important;
      color: #ffffff !important;
      border-bottom: 1px solid #333 !important;
    }

    [data-theme="dark"] .swagger-ui table tbody tr td {
      color: #ffffff !important;
      border-bottom: 1px solid #333 !important;
    }

    [data-theme="dark"] .swagger-ui .parameters-col_description {
      color: #e0e0e0 !important;
    }

    /* Responses */
    [data-theme="dark"] .swagger-ui .responses-inner {
      background: #0a0a0a !important;
    }

    [data-theme="dark"] .swagger-ui .response-col_status {
      color: #ffffff !important;
    }

    [data-theme="dark"] .swagger-ui .response-col_description,
    [data-theme="dark"] .swagger-ui .response-col_description p {
      color: #ffffff !important;
    }

    /* Models */
    [data-theme="dark"] .swagger-ui .model-box,
    [data-theme="dark"] .swagger-ui .model {
      background: #1a1a1a !important;
      border: 1px solid #333 !important;
    }

    [data-theme="dark"] .swagger-ui .model-title,
    [data-theme="dark"] .swagger-ui .model .property {
      color: #ffffff !important;
    }

    [data-theme="dark"] .swagger-ui .prop-type,
    [data-theme="dark"] .swagger-ui .prop-format {
      color: #61affe !important;
    }

    /* Code blocks */
    [data-theme="dark"] .swagger-ui .highlight-code,
    [data-theme="dark"] .swagger-ui pre,
    [data-theme="dark"] .swagger-ui code {
      background: #0a0a0a !important;
      color: #ffffff !important;
      border: 1px solid #333 !important;
    }

    /* Buttons */
    [data-theme="dark"] .swagger-ui .btn {
      background: #2a2a2a !important;
      color: #ffffff !important;
      border: 1px solid #444 !important;
    }

    [data-theme="dark"] .swagger-ui .btn:hover {
      background: #3a3a3a !important;
    }

    [data-theme="dark"] .swagger-ui .authorization__btn {
      background: #2a2a2a !important;
      color: #ffffff !important;
      border-color: #49cc90 !important;
    }

    /* Inputs */
    [data-theme="dark"] .swagger-ui input[type=text],
    [data-theme="dark"] .swagger-ui input[type=password],
    [data-theme="dark"] .swagger-ui input[type=search],
    [data-theme="dark"] .swagger-ui input[type=email],
    [data-theme="dark"] .swagger-ui input[type=url],
    [data-theme="dark"] .swagger-ui textarea,
    [data-theme="dark"] .swagger-ui select {
      background: #1a1a1a !important;
      color: #ffffff !important;
      border: 1px solid #444 !important;
    }

    /* Parameter name */
    [data-theme="dark"] .swagger-ui .parameter__name {
      color: #ffffff !important;
    }

    /* Schema */
    [data-theme="dark"] .swagger-ui .model-box-control,
    [data-theme="dark"] .swagger-ui section.models h4 {
      color: #ffffff !important;
    }

    /* Top bar */
    [data-theme="dark"] .swagger-ui .topbar {
      background: #0a0a0a !important;
      border-bottom: 1px solid #333 !important;
    }

    /* Markdown */
    [data-theme="dark"] .swagger-ui .markdown p,
    [data-theme="dark"] .swagger-ui .markdown code,
    [data-theme="dark"] .swagger-ui .renderedMarkdown p {
      color: #ffffff !important;
    }

    /* Tags */
    [data-theme="dark"] .swagger-ui .opblock-tag {
      color: #ffffff !important;
      border-bottom: 1px solid #333 !important;
    }

    /* Links */
    [data-theme="dark"] .swagger-ui a {
      color: #61affe !important;
    }

    /* Tabs */
    [data-theme="dark"] .swagger-ui .tab li {
      color: #ffffff !important;
    }

    [data-theme="dark"] .swagger-ui .tab li.active {
      background: #2a2a2a !important;
    }

    /* Error messages */
    [data-theme="dark"] .swagger-ui .errors-wrapper {
      background: #1a1a1a !important;
      border: 1px solid #f93e3e !important;
    }

    /* Execute button */
    [data-theme="dark"] .swagger-ui .btn.execute {
      background: #4990e2 !important;
      color: #ffffff !important;
      border-color: #4990e2 !important;
    }

    /* Copy button */
    [data-theme="dark"] .swagger-ui .copy-to-clipboard button {
      background: #2a2a2a !important;
      color: #ffffff !important;
    }

    /* Section backgrounds - make darker */
    [data-theme="dark"] .swagger-ui .opblock-body {
      background: #0a0a0a !important;
    }

    [data-theme="dark"] .swagger-ui .opblock-section {
      background: #0a0a0a !important;
    }

    [data-theme="dark"] .swagger-ui .opblock-section-request-body,
    [data-theme="dark"] .swagger-ui .opblock-section-response {
      background: #0a0a0a !important;
    }

    /* Parameters and Responses section headers - darker background */
    [data-theme="dark"] .swagger-ui .opblock-section-header {
      background: #050505 !important;
      border-bottom: 1px solid #333 !important;
      color: #ffffff !important;
    }

    [data-theme="dark"] .swagger-ui .opblock-section-header h4 {
      color: #ffffff !important;
      font-weight: 600 !important;
    }

    [data-theme="dark"] .swagger-ui .opblock-section-header label {
      color: #ffffff !important;
    }

    /* Parameters wrapper */
    [data-theme="dark"] .swagger-ui .parameters-wrapper {
      background: #0a0a0a !important;
    }

    [data-theme="dark"] .swagger-ui .table-container {
      background: #0a0a0a !important;
    }

    /* Response wrapper */
    [data-theme="dark"] .swagger-ui .responses-wrapper {
      background: #0a0a0a !important;
    }

    /* All nested divs in operation blocks */
    [data-theme="dark"] .swagger-ui .opblock-body > div,
    [data-theme="dark"] .swagger-ui .opblock-body > div > div,
    [data-theme="dark"] .swagger-ui .opblock-body section > div {
      background-color: #0a0a0a !important;
    }

    /* Parameter row backgrounds */
    [data-theme="dark"] .swagger-ui .parameters tbody tr {
      background: #0a0a0a !important;
    }

    [data-theme="dark"] .swagger-ui .parameters tbody tr:hover {
      background: #1a1a1a !important;
    }

    /* Response row backgrounds */
    [data-theme="dark"] .swagger-ui .responses tbody tr {
      background: #0a0a0a !important;
    }

    [data-theme="dark"] .swagger-ui .responses tbody tr:hover {
      background: #1a1a1a !important;
    }

    /* Label colors in sections */
    [data-theme="dark"] .swagger-ui .parameter__name.required,
    [data-theme="dark"] .swagger-ui .parameter__name {
      color: #ffffff !important;
    }

    [data-theme="dark"] .swagger-ui .parameter__type {
      color: #61affe !important;
    }

    /* Required asterisk */
    [data-theme="dark"] .swagger-ui .parameter__name.required:after {
      color: #f93e3e !important;
    }

    /* Content type selector */
    [data-theme="dark"] .swagger-ui .content-type {
      background: #0a0a0a !important;
      color: #ffffff !important;
    }

    /* Try it out section */
    [data-theme="dark"] .swagger-ui .try-out {
      background: #0a0a0a !important;
    }

    [data-theme="dark"] .swagger-ui .try-out__btn {
      background: #2a2a2a !important;
      color: #ffffff !important;
      border: 1px solid #444 !important;
    }

    /* Body param */
    [data-theme="dark"] .swagger-ui .body-param {
      background: #0a0a0a !important;
    }

    [data-theme="dark"] .swagger-ui .body-param__text {
      background: #050505 !important;
      color: #ffffff !important;
      border: 1px solid #333 !important;
    }

    /* Scheme container - dark background */
    [data-theme="dark"] .swagger-ui .scheme-container {
      background: #0a0a0a !important;
      border: 1px solid #333 !important;
    }

    [data-theme="dark"] .swagger-ui .schemes {
      background: #0a0a0a !important;
    }

    [data-theme="dark"] .swagger-ui .schemes > label {
      color: #ffffff !important;
    }

    [data-theme="dark"] .swagger-ui .schemes select {
      background: #1a1a1a !important;
      color: #ffffff !important;
      border: 1px solid #444 !important;
    }

    /* Hide the API info header section */
    .swagger-ui .info {
      display: none !important;
    }

    .swagger-ui .information-container {
      display: none !important;
    }

    /* Modal backgrounds - dark mode */
    [data-theme="dark"] .swagger-ui .modal-ux {
      background: rgba(0, 0, 0, 0.8) !important;
    }

    [data-theme="dark"] .swagger-ui .modal-ux-content {
      background: #1a1a1a !important;
      border: 1px solid #333 !important;
      color: #ffffff !important;
    }

    [data-theme="dark"] .swagger-ui .modal-ux-header {
      background: #0a0a0a !important;
      border-bottom: 1px solid #333 !important;
      color: #ffffff !important;
    }

    [data-theme="dark"] .swagger-ui .modal-ux-header h3 {
      color: #ffffff !important;
    }

    [data-theme="dark"] .swagger-ui .modal-ux-inner {
      background: #1a1a1a !important;
      color: #ffffff !important;
    }

    /* Better space utilization on smaller screens */
    .api-docs-container {
      padding: 1.5rem;
    }

    /* Medium screens - reduce padding slightly */
    @media (max-width: 1440px) {
      .api-docs-container {
        padding: 0.75rem !important;
      }
    }

    /* Laptop split view - more aggressive reduction */
    @media (max-width: 1024px) {
      .api-docs-container {
        max-width: 100% !important;
        padding: 0.5rem !important;
      }
    }

    /* Tablet */
    @media (max-width: 768px) {
      .api-docs-container {
        padding: 0.5rem !important;
      }
    }

    /* Mobile */
    @media (max-width: 640px) {
      .api-docs-container {
        padding: 0.25rem !important;
      }
    }
  </style>
</svelte:head>

<div class="container mx-auto max-w-7xl api-docs-container">
  <h1 class="text-3xl font-bold mb-4">🚀 API Documentation</h1>

  <div class="alert alert-info mb-6">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
    <div>
      <h3 class="font-bold">How to Test the API</h3>
      <div class="text-sm">
        <ol class="list-decimal list-inside space-y-1 mt-2">
          <li>Copy your JWT token below</li>
          <li>Click the green <strong>"Authorize"</strong> button in Swagger UI</li>
          <li>Paste the token (without "Bearer")</li>
          <li>Click <strong>"Authorize"</strong> then <strong>"Close"</strong></li>
          <li>Test any endpoint by clicking <strong>"Try it out"</strong></li>
        </ol>
      </div>
    </div>
  </div>

  {#if user}
    <div class="card bg-base-200 shadow-xl mb-6">
      <div class="card-body">
        <h2 class="card-title">🔑 Your JWT Access Token</h2>
        <div class="alert alert-success mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
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
            <button class="btn btn-primary" onclick={copyJwtToken}>
              {copyButtonText}
            </button>
          </div>
        {:else}
          <div class="flex gap-2 items-center">
            <span class="loading loading-spinner loading-sm"></span>
            <span class="text-sm">Getting JWT token...</span>
          </div>
        {/if}
      </div>
    </div>

    <div class="card bg-base-300 shadow-xl mb-6">
      <div class="card-body">
        <h2 class="card-title">🤖 Testing Third-Party App Access</h2>
        <div class="text-sm space-y-2">
          <p><strong>Yes!</strong> You can test third-party app access (service accounts) from Swagger UI:</p>
          <ol class="list-decimal list-inside space-y-2 ml-4">
            <li><strong>Create Service Account:</strong> Use <code class="bg-base-100 px-2 py-1 rounded">POST /api/service-accounts</code> to create a bot account</li>
            <li><strong>Get Token:</strong> Use <code class="bg-base-100 px-2 py-1 rounded">POST /api/auth/token</code> with <code>client_id</code> and <code>client_secret</code></li>
            <li><strong>Authorize:</strong> Use the service account token in the "Authorize" button</li>
            <li><strong>Test:</strong> The service account can only access endpoints matching its scopes</li>
          </ol>
          <div class="alert alert-warning mt-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <div class="text-sm">
              <strong>Save the client_secret!</strong> It's only shown once when you create the service account.
            </div>
          </div>
        </div>
      </div>
    </div>
  {:else}
    <div class="alert alert-warning mb-6">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
      <span>Loading user information...</span>
    </div>
  {/if}

  <div id="swagger-ui"></div>
</div>