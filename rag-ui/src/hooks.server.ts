// SvelteKit Server Hooks - Initialize API Authentication

import { ApiAuth } from '$lib/api-auth.js';

// Initialize API authentication system on server startup
(async () => {
  await ApiAuth.initialize();
  console.log('🚀 RAG System API initialized');
  console.log('📡 API endpoints available at /api/*');
  console.log('📖 Documentation: Available at /api-docs');
  console.log('🔑 Generate test API keys at /api-docs (API Tester tab)');
})();

// Handle all server-side logic
export async function handle({ event, resolve }) {
  // Add CORS headers for API endpoints
  if (event.url.pathname.startsWith('/api/')) {
    // Handle preflight OPTIONS requests
    if (event.request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400'
        }
      });
    }
  }

  const response = await resolve(event);

  // Add CORS headers to API responses
  if (event.url.pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  return response;
}