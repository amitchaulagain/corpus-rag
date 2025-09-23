// Test API Key Generation Endpoint (Development Only)

import type { RequestHandler } from './$types';
import { ApiAuth } from '$lib/api-auth.js';
import { handleApiRequest, success, error } from '$lib/api-utils.js';
import { dev } from '$app/environment';

export const GET: RequestHandler = async () => {
  // Only allow in development mode
  if (!dev) {
    return new Response(JSON.stringify(await error('Test endpoint only available in development')), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return await handleApiRequest(async () => {
    // Generate a test API key with all permissions
    const testKey = await ApiAuth.generateApiKey(
      'test-user@example.com',
      'Auto-generated Test Key',
      ['admin', 'files:read', 'files:write', 'corpus:read', 'rag:query', 'rag:import', 'system:status']
    );

    return {
      apiKey: testKey.key,
      testUserId: 'test-user@example.com',
      message: 'Test API key generated for development testing'
    };
  });
};