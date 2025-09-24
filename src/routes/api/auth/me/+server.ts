// User Info Endpoint

import type { RequestHandler } from './$types';
import { authenticateRequest, handleApiRequest, handleOptions, addCorsHeaders } from '$lib/api-utils.js';

// Handle preflight OPTIONS requests
export const OPTIONS: RequestHandler = () => {
  return handleOptions();
};

// GET /api/auth/me - Get current user info
export const GET: RequestHandler = async (event) => {
  const auth = await authenticateRequest(event);
  if (auth instanceof Response) {
    return addCorsHeaders(auth);
  }

  const response = await handleApiRequest(async () => {
    return {
      user: {
        id: auth.user.id,
        email: auth.user.email,
        scopes: auth.user.scopes
      },
      apiKey: {
        id: auth.apiKey!.id,
        name: auth.apiKey!.name,
        scopes: auth.apiKey!.scopes,
        lastUsed: auth.apiKey!.lastUsed
      },
      rateLimit: {
        remaining: auth.rateLimit.remaining,
        resetTime: auth.rateLimit.resetTime
      }
    };
  });

  return addCorsHeaders(response);
};