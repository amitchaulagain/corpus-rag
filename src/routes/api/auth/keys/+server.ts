// API Key Management Endpoints

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { ApiAuth } from '$lib/api-auth.js';
import { getDB } from '$lib/db/mongodb';
import { SessionModel } from '$lib/models/session';
import { UserModel } from '$lib/models/user';

// Authenticate using session token (for web app users)
async function authenticateSession(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const db = await getDB();
  const sessionModel = new SessionModel(db);
  const userModel = new UserModel(db);

  const session = await sessionModel.findByToken(token);
  if (!session) {
    return null;
  }

  const user = await userModel.findById(session.userId.toString());
  if (!user) {
    return null;
  }

  return user;
}

// GET /api/auth/keys - List user's API keys
export const GET: RequestHandler = async ({ request }) => {
  const authHeader = request.headers.get('Authorization');
  const user = await authenticateSession(authHeader);

  if (!user) {
    return json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const apiKeys = await ApiAuth.getUserApiKeys(user._id!.toString());
    return json({ success: true, data: { apiKeys } });
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve API keys'
    }, { status: 500 });
  }
};

// POST /api/auth/keys - Create new API key
export const POST: RequestHandler = async ({ request }) => {
  const authHeader = request.headers.get('Authorization');
  const user = await authenticateSession(authHeader);

  if (!user) {
    return json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const requestBody = await request.json().catch(() => null);
  if (!requestBody || typeof requestBody.name !== 'string' || !Array.isArray(requestBody.scopes)) {
    return json({
      success: false,
      error: 'Name and scopes are required'
    }, { status: 400 });
  }

  try {
    const result = await ApiAuth.generateApiKey(
      user._id!.toString(),
      requestBody.name,
      requestBody.scopes
    );

    return json({
      success: true,
      data: {
        apiKey: result.key,
        keyInfo: {
          id: result.keyInfo._id?.toString(),
          name: result.keyInfo.name,
          scopes: result.keyInfo.scopes,
          keyPrefix: result.keyInfo.keyPrefix,
          createdAt: result.keyInfo.createdAt
        }
      }
    });
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate API key'
    }, { status: 500 });
  }
};

// DELETE /api/auth/keys/:keyId - Revoke API key
export const DELETE: RequestHandler = async ({ request, params }) => {
  const authHeader = request.headers.get('Authorization');
  const user = await authenticateSession(authHeader);

  if (!user) {
    return json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const keyId = params.keyId;
  if (!keyId) {
    return json({
      success: false,
      error: 'Key ID is required'
    }, { status: 400 });
  }

  try {
    const revoked = await ApiAuth.revokeApiKey(keyId);

    if (!revoked) {
      return json({
        success: false,
        error: 'API key not found'
      }, { status: 404 });
    }

    return json({
      success: true,
      data: { revoked }
    });
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to revoke API key'
    }, { status: 500 });
  }
};