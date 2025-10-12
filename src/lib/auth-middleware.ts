// Authentication Middleware
import type { RequestEvent } from '@sveltejs/kit';
import { getDB } from './db/mongodb';
import { SessionModel } from './models/session';
import { UserModel, type User } from './models/user';

export interface AuthenticatedUser {
  user: User;
  token: string;
}

export async function authenticate(event: RequestEvent): Promise<AuthenticatedUser | null> {
  try {
    const authHeader = event.request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return null;
    }

    const db = await getDB();
    const sessionModel = new SessionModel(db);
    const userModel = new UserModel(db);

    // Find session
    const session = await sessionModel.findByToken(token);
    if (!session) {
      return null;
    }

    // Find user
    const user = await userModel.findById(session.userId);
    if (!user) {
      return null;
    }

    return { user, token };

  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

export function checkPermission(user: User, endpoint: keyof User['apiPermissions']): boolean {
  // Admin has all permissions
  if (user.userType === 'admin') {
    return true;
  }

  // Check specific permission
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
