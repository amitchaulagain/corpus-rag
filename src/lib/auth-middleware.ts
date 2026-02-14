// COMPATIBILITY LAYER - Wraps JWT auth for backward compatibility
// ⚠️ This is a wrapper around jwt-middleware.ts for old code
// ⚠️ New code should import from jwt-middleware.ts directly

import type { RequestEvent } from '@sveltejs/kit';
import { authenticateJwt } from './jwt-middleware';
import { getDB } from './db/mongodb';
import { UserModel, type User } from './models/user';
import { SessionModel } from './models/session';

export interface AuthenticatedUser {
  user: User;
  token: string;
}

// Helper: Authenticate using session token (for web UI)
async function authenticateSession(event: RequestEvent): Promise<AuthenticatedUser | null> {
  const authHeader = event.request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return null;
  }

  const db = await getDB();
  const sessionModel = new SessionModel(db);
  const userModel = new UserModel(db);

  // Validate session
  const session = await sessionModel.findByToken(token);
  if (!session) {
    return null;
  }

  // Get user
  const user = await userModel.findById(session.userId);
  if (!user) {
    return null;
  }

  return {
    user,
    token
  };
}

// Wrapper: Converts JWT auth to old session-based auth format
// Also supports session tokens for web UI compatibility
export async function authenticate(event: RequestEvent): Promise<AuthenticatedUser | null> {
  // Try JWT first
  const jwtAuth = await authenticateJwt(event);
  
  if (!(jwtAuth instanceof Response)) {
    // JWT auth succeeded
    const db = await getDB();
    const userModel = new UserModel(db);
    const user = await userModel.findById(jwtAuth.user.id);

    if (!user) {
      return null;
    }

    return {
      user,
      token: 'jwt-token'
    };
  }

  // JWT failed, try session token
  return await authenticateSession(event);
}

export function checkPermission(user: User, endpoint: keyof User['apiPermissions']): boolean {
  if (user.userType === 'admin') {
    return true;
  }
  return user.apiPermissions[endpoint] === true;
}

export async function requireAuth(event: RequestEvent): Promise<AuthenticatedUser> {
  const auth = await authenticate(event);
  if (!auth) {
    throw new Error('Authentication required');
  }
  return auth;
}

export async function requirePermission(
  event: RequestEvent,
  endpoint: keyof User['apiPermissions']
): Promise<AuthenticatedUser> {
  const auth = await requireAuth(event);
  if (!checkPermission(auth.user, endpoint)) {
    throw new Error(`Permission denied: ${endpoint}`);
  }
  return auth;
}

export async function requireAdmin(event: RequestEvent): Promise<AuthenticatedUser> {
  const auth = await requireAuth(event);
  if (auth.user.userType !== 'admin') {
    throw new Error('Admin access required');
  }
  return auth;
}
