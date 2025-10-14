// JWT Authentication Middleware
import type { RequestEvent } from '@sveltejs/kit';
import { JwtAuth } from './jwt-auth';
import { getDB } from './db/mongodb';
import { RateLimitModel } from './models/rate-limit';
import type { ApiScope } from './api-types';
import type { AccessTokenPayload, ServiceAccountTokenPayload } from './jwt-auth';

export interface JwtAuthenticatedRequest {
  user: {
    id: string;
    email?: string;
    type: 'user' | 'service';
    userType?: string;
    scopes: ApiScope[];
  };
  token: AccessTokenPayload | ServiceAccountTokenPayload;
  rateLimit: {
    remaining: number;
    resetTime: Date;
  };
}

export async function authenticateJwt(event: RequestEvent): Promise<JwtAuthenticatedRequest | Response> {
  // Extract token
  const authHeader = event.request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Bearer token required'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.substring(7);

  // Verify JWT
  let decoded: AccessTokenPayload | ServiceAccountTokenPayload;
  try {
    decoded = JwtAuth.verifyToken(token) as AccessTokenPayload | ServiceAccountTokenPayload;
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid token'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Check token type
  if (decoded.type !== 'access' && decoded.type !== 'service') {
    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid token type'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Rate limiting
  const db = await getDB();
  const rateLimitModel = new RateLimitModel(db);

  const identifierType = decoded.type === 'service' ? 'service_account' : 'user';
  const limit = decoded.type === 'service' ? 5000 : 1000; // TODO: Get from user/account config

  const rateLimit = await rateLimitModel.check(decoded.sub, identifierType, limit, 3600);

  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Rate limit exceeded'
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': rateLimit.resetTime.toISOString()
      }
    });
  }

  // Build user object
  const user = decoded.type === 'access' ? {
    id: decoded.sub,
    email: (decoded as AccessTokenPayload).email,
    type: 'user' as const,
    userType: (decoded as AccessTokenPayload).userType,
    scopes: decoded.scopes
  } : {
    id: decoded.sub,
    type: 'service' as const,
    scopes: decoded.scopes
  };

  return {
    user,
    token: decoded,
    rateLimit: {
      remaining: rateLimit.remaining,
      resetTime: rateLimit.resetTime
    }
  };
}

export function requireJwtScope(auth: JwtAuthenticatedRequest, requiredScope: ApiScope): boolean {
  return auth.user.scopes.includes(requiredScope) || auth.user.scopes.includes('admin' as ApiScope);
}
