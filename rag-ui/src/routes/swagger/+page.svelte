<!-- Official Swagger UI Page -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';

  let swaggerContainer: HTMLDivElement;

  function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  onMount(async () => {
    // Load Swagger UI from static assets
    await loadScript('/swagger-ui/swagger-ui-bundle.js');
    await loadScript('/swagger-ui/swagger-ui-standalone-preset.js');

    // @ts-ignore - SwaggerUIBundle is loaded globally
    const SwaggerUIBundle = window.SwaggerUIBundle;
    // @ts-ignore - SwaggerUIStandalonePreset is loaded globally  
    const SwaggerUIStandalonePreset = window.SwaggerUIStandalonePreset;

    // Initialize Swagger UI
    const ui = SwaggerUIBundle({
      url: '/api/swagger.json',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIStandalonePreset
      ],
      plugins: [
        SwaggerUIBundle.plugins.DownloadUrl
      ],
      layout: "StandaloneLayout",
      validatorUrl: null,
      tryItOutEnabled: true,
      supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
      onComplete: () => {
        console.log('✅ Swagger UI loaded successfully');
        // Auto-load test API key for the authenticated user
        loadTestApiKey();
      }
    });

    // Function to automatically load and set API key
    async function loadTestApiKey() {
      try {
        // Get the current user from the main app (if available)
        const userId = getAuthenticatedUserId();
        if (!userId) {
          console.log('ℹ️ No authenticated user found. Please authenticate in the main app first.');
          return;
        }

        // Load test API key
        const response = await fetch(`/api/auth/test-key?userId=${encodeURIComponent(userId)}`);
        const data = await response.json();

        if (data.success) {
          const apiKey = `Bearer ${data.data.apiKey}`;
          
          // Set the API key in Swagger UI
          ui.preauthorizeApiKey('ApiKeyAuth', apiKey);
          
          console.log(`🔑 Auto-loaded API key for user: ${data.data.testUserId}`);
          showApiKeyNotification(data.data.apiKey);
        }
      } catch (error) {
        console.log('ℹ️ Could not auto-load API key. You can generate one manually.');
      }
    }

    // Get authenticated user ID from localStorage or session
    function getAuthenticatedUserId() {
      // Try to get user from various sources
      try {
        // Check if we have user info in localStorage
        const userInfo = localStorage.getItem('ragUserInfo');
        if (userInfo) {
          return JSON.parse(userInfo).email;
        }
        
        // Check URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('userId');
        if (userId) {
          return userId;
        }
        
        // Default to the configured user in env
        return 'achaulagain123@gmail.com';
      } catch (error) {
        return null;
      }
    }

    // Show notification about API key
    function showApiKeyNotification(apiKey) {
      const notification = document.createElement('div');
      notification.innerHTML = `
        <div style="
          position: fixed; 
          top: 20px; 
          right: 20px; 
          background: #4CAF50; 
          color: white; 
          padding: 15px 20px; 
          border-radius: 8px; 
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          z-index: 10000;
          max-width: 400px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">
          <div style="font-weight: bold; margin-bottom: 8px;">🔑 API Key Loaded!</div>
          <div style="font-size: 13px; opacity: 0.9;">
            Your test API key has been automatically configured.<br>
            You can now test all endpoints that require authentication.
          </div>
          <div style="margin-top: 10px; font-size: 11px; opacity: 0.8; word-break: break-all;">
            Key: ${apiKey.substring(0, 20)}...
          </div>
        </div>
      `;
      
      document.body.appendChild(notification);
      
      // Remove notification after 5 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 5000);
    }
  });
</script>

<svelte:head>
  <title>API Documentation - RAG System</title>
  <meta name="description" content="Interactive Swagger UI documentation for the RAG System API" />
  
  <!-- Swagger UI CSS -->
  <link rel="stylesheet" type="text/css" href="/swagger-ui/swagger-ui.css" />
  
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *, *:before, *:after {
      box-sizing: inherit;
    }
    body {
      margin:0;
      background: #fafafa;
    }
  </style>
</svelte:head>

<div class="swagger-page">
  <div class="header">
    <h1>🚀 RAG System API Documentation</h1>
    <p>Interactive Swagger UI for testing and exploring the RAG System API</p>
    
    <div class="api-info-banner">
      <div class="info-item">
        <strong>🔑 Authentication:</strong> RAG System API keys (auto-loaded for achaulagain123@gmail.com)
      </div>
      <div class="info-item">
        <strong>🌐 Google API Key:</strong> Configured (AIzaSyCI-zsRP85UVOi0DjtiCwWBwQ1djDy741g)
      </div>
      <div class="info-item">
        <strong>📡 Base URL:</strong> /api
      </div>
    </div>
    
    <div class="nav-links">
      <a href="/" class="nav-link">← Back to App</a>
      <a href="/api-docs" class="nav-link">Custom API Tester</a>
      <a href="/swagger?userId=achaulagain123@gmail.com" class="nav-link">🔄 Reload with User</a>
    </div>
  </div>
  
  <div id="swagger-ui" bind:this={swaggerContainer}></div>
</div>

<style>
  .swagger-page {
    min-height: 100vh;
    background: #fafafa;
  }

  .header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 2rem;
    text-align: center;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  }

  .header h1 {
    margin: 0 0 0.5rem 0;
    font-size: 2.5rem;
    font-weight: 700;
  }

  .header p {
    margin: 0 0 1.5rem 0;
    font-size: 1.1rem;
    opacity: 0.9;
  }

  .api-info-banner {
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 8px;
    padding: 1rem;
    margin: 1.5rem 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 0.5rem;
  }

  .api-info-banner .info-item {
    font-size: 0.9rem;
    opacity: 0.95;
  }

  .api-info-banner .info-item strong {
    color: #fff;
  }

  .nav-links {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .nav-link {
    color: white;
    text-decoration: none;
    padding: 0.5rem 1rem;
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: 6px;
    transition: all 0.3s ease;
    font-weight: 500;
  }

  .nav-link:hover {
    background: rgba(255,255,255,0.2);
    border-color: rgba(255,255,255,0.5);
    transform: translateY(-2px);
  }

  #swagger-ui {
    max-width: none;
  }

  /* Custom Swagger UI overrides */
  :global(.swagger-ui .topbar) {
    display: none;
  }

  :global(.swagger-ui .info) {
    margin: 2rem 0;
  }

  :global(.swagger-ui .scheme-container) {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 1rem;
    margin: 1rem 0;
  }

  :global(.swagger-ui .auth-wrapper) {
    border: 1px solid #667eea;
    border-radius: 8px;
    padding: 1rem;
    background: #f8f9ff;
  }

  :global(.swagger-ui .btn.authorize) {
    background: #667eea;
    border-color: #667eea;
  }

  :global(.swagger-ui .btn.authorize:hover) {
    background: #5a6fd8;
    border-color: #5a6fd8;
  }
</style>
