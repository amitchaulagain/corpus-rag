// API Utility Functions

import type { RequestEvent } from '@sveltejs/kit';
import type { ApiResponse, ApiError, AuthenticatedRequest } from './api-types.js';
import { ApiAuth, RateLimit } from './api-auth.js';
import { browser } from '$app/environment';

// Browser-safe random ID generation
async function generateRandomId(length: number): Promise<string> {
  if (browser) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  } else {
    const { randomBytes } = await import('crypto');
    return randomBytes(length).toString('hex');
  }
}

// Create standardized API response
export async function createApiResponse<T>(
  success: boolean,
  data?: T,
  error?: string | ApiError,
  requestId?: string
): Promise<ApiResponse<T>> {
  return {
    success,
    data,
    error: typeof error === 'string' ? error : error?.message,
    timestamp: new Date().toISOString(),
    requestId: requestId || await generateRequestId()
  };
}

// Generate unique request ID
export async function generateRequestId(): Promise<string> {
  return await generateRandomId(8);
}

// Success response helper
export async function success<T>(data: T, requestId?: string): Promise<ApiResponse<T>> {
  return await createApiResponse(true, data, undefined, requestId);
}

// Error response helper
export async function error(message: string, requestId?: string): Promise<ApiResponse> {
  return await createApiResponse(false, undefined, message, requestId);
}

// Validation error helper
export async function validationError(message: string, details?: any, requestId?: string): Promise<ApiResponse> {
  return await createApiResponse(false, undefined, {
    code: 'VALIDATION_ERROR',
    message,
    details
  } as ApiError, requestId);
}

// Authentication error helper
export async function authError(message = 'Authentication required', requestId?: string): Promise<ApiResponse> {
  return await createApiResponse(false, undefined, {
    code: 'AUTH_ERROR',
    message
  } as ApiError, requestId);
}

// Authorization error helper
export async function authzError(message = 'Insufficient permissions', requestId?: string): Promise<ApiResponse> {
  return await createApiResponse(false, undefined, {
    code: 'AUTHORIZATION_ERROR',
    message
  } as ApiError, requestId);
}

// Rate limit error helper
export async function rateLimitError(resetTime: number, requestId?: string): Promise<ApiResponse> {
  return await createApiResponse(false, undefined, {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Rate limit exceeded',
    details: { resetTime }
  } as ApiError, requestId);
}

// Authentication middleware for SvelteKit
export async function authenticateRequest(event: RequestEvent): Promise<AuthenticatedRequest | Response> {
  const requestId = await generateRequestId();

  // Check for API key in Authorization header
  const authHeader = event.request.headers.get('Authorization');
  let apiKey: string | null = null;

  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    }
  } else {
    // Check for API key in query parameter (less secure, but convenient for testing)
    apiKey = event.url.searchParams.get('api_key');
  }

  if (!apiKey) {
    return new Response(JSON.stringify(await authError('API key required', requestId)), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Validate API key
  const keyInfo = await ApiAuth.validateApiKey(apiKey);
  if (!keyInfo) {
    return new Response(JSON.stringify(await authError('Invalid API key', requestId)), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Check rate limits
  const rateLimit = await RateLimit.check(apiKey);
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify(await rateLimitError(rateLimit.resetTime, requestId)), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': rateLimit.resetTime.toString()
      }
    });
  }

  // Return authenticated request context
  return {
    user: {
      id: keyInfo.userId.toString(),
      email: keyInfo.userId.toString(), // Using userId as email for now
      scopes: keyInfo.scopes
    },
    apiKey: keyInfo,
    rateLimit: {
      remaining: rateLimit.remaining,
      resetTime: rateLimit.resetTime
    }
  };
}

// Scope validation middleware
export function requireScope(auth: AuthenticatedRequest, requiredScope: string): boolean {
  return ApiAuth.hasScope(auth.apiKey!, requiredScope as any);
}

// Validate request body
export async function validateRequestBody<T>(
  request: Request,
  validator: (body: any) => T | null
): Promise<T | null> {
  try {
    const body = await request.json();
    return validator(body);
  } catch {
    return null;
  }
}

// Common validators
export const validators = {
  uploadRequest: (body: any) => {
    if (typeof body.userId !== 'string' || !body.userId.trim()) {
      return null;
    }
    return {
      userId: body.userId.trim(),
      replaceExisting: Boolean(body.replaceExisting)
    };
  },

  queryRequest: (body: any) => {
    if (typeof body.userId !== 'string' || !body.userId.trim() ||
        typeof body.question !== 'string' || !body.question.trim()) {
      return null;
    }
    return {
      userId: body.userId.trim(),
      question: body.question.trim(),
      context: typeof body.context === 'string' ? body.context.trim() : undefined,
      maxResults: typeof body.maxResults === 'number' ? body.maxResults : 5
    };
  },

  importRequest: (body: any) => {
    if (typeof body.userId !== 'string' || !body.userId.trim() ||
        !Array.isArray(body.cloudStorageUris) || body.cloudStorageUris.length === 0) {
      return null;
    }
    return {
      userId: body.userId.trim(),
      cloudStorageUris: body.cloudStorageUris.filter((uri: any) => typeof uri === 'string'),
      waitForCompletion: Boolean(body.waitForCompletion)
    };
  },

  corpusRequest: (body: any) => {
    if (typeof body.userId !== 'string' || !body.userId.trim()) {
      return null;
    }
    return {
      userId: body.userId.trim()
    };
  }
};

// Error handling wrapper
export async function handleApiRequest<T>(
  handler: () => Promise<T>,
  requestId?: string
): Promise<Response> {
  try {
    const result = await handler();
    return new Response(JSON.stringify(await success(result, requestId)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('API Error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Internal server error';
    return new Response(JSON.stringify(await error(errorMessage, requestId)), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Add CORS headers for external API access
export function addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Max-Age', '86400');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

// Handle preflight OPTIONS requests
export function handleOptions(): Response {
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