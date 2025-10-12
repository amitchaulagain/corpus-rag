// Session API endpoint - returns current user's API key
import type { RequestHandler } from './$types';
import { handleOptions, addCorsHeaders } from '$lib/api-utils.js';
import { ApiAuth } from '$lib/api-auth.js';

// Handle preflight OPTIONS requests
export const OPTIONS: RequestHandler = () => {
  return handleOptions();
};

// GET /api/session - Get current session API key
export const GET: RequestHandler = async (event) => {
  try {
    // Get all API keys and find the user key
    const allKeys = await ApiAuth.getAllApiKeys();
    const userKey = allKeys.find(key => key.scopes.includes('files:read') && !key.scopes.includes('admin'));

    if (!userKey) {
      return addCorsHeaders(new Response(JSON.stringify({
        success: false,
        error: 'No user API key found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      }));
    }

    return addCorsHeaders(new Response(JSON.stringify({
      success: true,
      data: {
        apiKey: userKey.keyPrefix + '...', // Only show prefix, not full key
        scopes: userKey.scopes,
        keyName: userKey.name
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));

  } catch (error) {
    console.error('Session error:', error);
    return addCorsHeaders(new Response(JSON.stringify({
      success: false,
      error: 'Failed to get session info'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }));
  }
};