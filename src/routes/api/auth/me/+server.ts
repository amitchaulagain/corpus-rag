// User Info Endpoint (JWT)
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateJwt } from '$lib/jwt-middleware';

// GET /api/auth/me - Get current user info
export const GET: RequestHandler = async (event) => {
  const auth = await authenticateJwt(event);
  if (auth instanceof Response) {
    return auth;
  }

  return json({
    success: true,
    data: {
      user: {
        id: auth.user.id,
        email: auth.user.email,
        type: auth.user.type,
        userType: auth.user.userType,
        scopes: auth.user.scopes
      },
      token: {
        type: auth.token.type,
        expiresAt: auth.token.exp ? new Date(auth.token.exp * 1000).toISOString() : null
      },
      rateLimit: {
        remaining: auth.rateLimit.remaining,
        resetTime: auth.rateLimit.resetTime.toISOString()
      }
    }
  });
};
