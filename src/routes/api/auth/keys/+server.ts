// API Key Management Endpoints

import type { RequestHandler } from './$types';
import { ApiAuth } from '$lib/api-auth.js';
import { authenticateRequest, handleApiRequest, requireScope, validators, validationError, authzError, handleOptions, addCorsHeaders } from '$lib/api-utils.js';

// Handle preflight OPTIONS requests
export const OPTIONS: RequestHandler = () => {
  return handleOptions();
};

// GET /api/auth/keys - List user's API keys
export const GET: RequestHandler = async (event) => {
  const auth = await authenticateRequest(event);
  if (auth instanceof Response) {
    return addCorsHeaders(auth);
  }

  if (!requireScope(auth, 'admin')) {
    return addCorsHeaders(new Response(JSON.stringify(authzError()), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  const response = await handleApiRequest(async () => {
    const apiKeys = ApiAuth.getUserApiKeys(auth.user.id);
    return { apiKeys };
  });

  return addCorsHeaders(response);
};

// POST /api/auth/keys - Create new API key
export const POST: RequestHandler = async (event) => {
  const auth = await authenticateRequest(event);
  if (auth instanceof Response) {
    return addCorsHeaders(auth);
  }

  if (!requireScope(auth, 'admin')) {
    return addCorsHeaders(new Response(JSON.stringify(authzError()), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  const requestBody = await event.request.json().catch(() => null);
  if (!requestBody || typeof requestBody.name !== 'string' || !Array.isArray(requestBody.scopes)) {
    return addCorsHeaders(new Response(JSON.stringify(validationError('Name and scopes are required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  const response = await handleApiRequest(async () => {
    const apiKey = ApiAuth.generateApiKey(
      auth.user.id,
      requestBody.name,
      requestBody.scopes
    );
    return { apiKey };
  });

  return addCorsHeaders(response);
};

// DELETE /api/auth/keys/:keyId - Revoke API key
export const DELETE: RequestHandler = async (event) => {
  const auth = await authenticateRequest(event);
  if (auth instanceof Response) {
    return addCorsHeaders(auth);
  }

  if (!requireScope(auth, 'admin')) {
    return addCorsHeaders(new Response(JSON.stringify(authzError()), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  const keyId = event.params.keyId;
  if (!keyId) {
    return addCorsHeaders(new Response(JSON.stringify(validationError('Key ID is required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  const response = await handleApiRequest(async () => {
    // For simplicity, we'll find the key by ID and revoke it
    const userKeys = ApiAuth.getUserApiKeys(auth.user.id);
    const targetKey = userKeys.find(k => k.id === keyId);

    if (!targetKey) {
      throw new Error('API key not found');
    }

    const revoked = ApiAuth.revokeApiKey(targetKey.key);
    return { revoked };
  });

  return addCorsHeaders(response);
};