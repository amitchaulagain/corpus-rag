// COMPATIBILITY LAYER - Wraps JWT auth for backward compatibility
// ⚠️ This is a wrapper around jwt-middleware.ts for old code
// ⚠️ New code should import from jwt-middleware.ts directly

import type { RequestEvent } from '@sveltejs/kit';
import { authenticateJwt } from './jwt-middleware';
import { getDB } from './db/mongodb';
import { UserModel, type User } from './models/user';

export interface AuthenticatedUser {
  user: User;
  token: string;
}

// Wrapper: Converts JWT auth to old session-based auth format
export async function authenticate(event: RequestEvent): Promise<AuthenticatedUser | null> {
  const auth = await authenticateJwt(event);

  if (auth instanceof Response) {
    return null;
  }

  // Get full user object from database
  const db = await getDB();
  const userModel = new UserModel(db);
  const user = await userModel.findById(auth.user.id);

  if (!user) {
    return null;
  }

  return {
    user,
    token: 'jwt-token'
  };
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
