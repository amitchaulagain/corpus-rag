// Test API Key Generation Endpoint (Development Only)

import type { RequestHandler } from './$types';
import { ApiAuth } from '$lib/api-auth.js';
import { handleApiRequest, success, error } from '$lib/api-utils.js';
import { dev } from '$app/environment';

export const GET: RequestHandler = async (event) => {
  // Only allow in development mode
  if (!dev) {
    return new Response(JSON.stringify(await error('Test endpoint only available in development')), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return await handleApiRequest(async () => {
    // Try to get the userId from query parameters (passed from authenticated UI)
    const userId = event.url.searchParams.get('userId') || 'test-user@example.com';
    
    // Generate a test API key with all permissions
    const testKey = await ApiAuth.generateApiKey(
      userId,
      'Auto-generated Test Key',
      ['admin', 'files:read', 'files:write', 'corpus:read', 'rag:query', 'rag:import', 'system:status']
    );

    return {
      apiKey: testKey.key,
      testUserId: userId,
      message: `Test API key generated for ${userId}`
    };
  });
};