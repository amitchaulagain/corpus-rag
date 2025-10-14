// COMPATIBILITY LAYER - Wraps JWT auth for backward compatibility
// ⚠️ This is a wrapper for old code that uses api-utils
// ⚠️ New code should use jwt-middleware.ts directly

import type { RequestEvent } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { authenticateJwt } from './jwt-middleware';
import type { JwtAuthenticatedRequest } from './jwt-middleware';

// Handle OPTIONS requests (CORS)
export function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

// Add CORS headers to response
export function addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

// Authenticate request using JWT
export async function authenticateRequest(event: RequestEvent): Promise<JwtAuthenticatedRequest | Response> {
  return await authenticateJwt(event);
}

// Check if user has required scope
export function requireScope(auth: JwtAuthenticatedRequest, requiredScope: string): boolean {
  return auth.user.scopes.includes(requiredScope as any) || auth.user.scopes.includes('admin' as any);
}

// Handle API request with error handling
export async function handleApiRequest(handler: () => Promise<any>): Promise<Response> {
  try {
    const result = await handler();
    return json({ success: true, data: result });
  } catch (error) {
    console.error('API request error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
