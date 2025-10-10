// User CRUD operations with MongoDB
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { userService } from '$lib/db/user-service';

// Helper to verify admin auth
async function requireAdmin(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing authorization');
  }

  const token = authHeader.substring(7);
  const session = await userService.findSessionByToken(token);
  if (!session) {
    throw new Error('Invalid or expired session');
  }

  const user = await userService.findUserById(session.userId);
  if (!user || user.userType !== 'admin') {
    throw new Error('Admin access required');
  }

  return { user, session };
}

// GET - List all users
export const GET: RequestHandler = async ({ request }) => {
  try {
    await requireAdmin(request);
    const users = await userService.getAllUsers();

    return json({
      success: true,
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        picture: u.picture,
        userType: u.userType,
        isPaid: u.isPaid,
        apiPermissions: u.apiPermissions,
        createdAt: u.createdAt,
        lastLogin: u.lastLogin
      }))
    });
  } catch (error) {
    console.error('GET users error:', error);
    return json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load users' },
      { status: error instanceof Error && error.message.includes('Admin') ? 403 : 500 }
    );
  }
};

// POST - Create new user
export const POST: RequestHandler = async ({ request }) => {
  try {
    await requireAdmin(request);
    const { email, name, userType, isPaid } = await request.json();

    if (!email || !name) {
      return json(
        { success: false, error: 'Email and name are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existing = await userService.findUserByEmail(email);
    if (existing) {
      return json(
        { success: false, error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    const user = await userService.createUser({
      email,
      name,
      userType: userType || 'freetier',
      isPaid: isPaid || false,
      apiPermissions: userService.constructor.getDefaultPermissions(userType || 'freetier')
    });

    return json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        userType: user.userType,
        isPaid: user.isPaid,
        apiPermissions: user.apiPermissions
      }
    });
  } catch (error) {
    console.error('POST user error:', error);
    return json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create user' },
      { status: error instanceof Error && error.message.includes('Admin') ? 403 : 500 }
    );
  }
};

// PUT - Update user
export const PUT: RequestHandler = async ({ request }) => {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const { id, name, userType, isPaid, apiPermissions } = body;

    if (!id) {
      return json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (userType !== undefined) updates.userType = userType;
    if (isPaid !== undefined) updates.isPaid = isPaid;
    if (apiPermissions !== undefined) updates.apiPermissions = apiPermissions;

    const user = await userService.updateUser(id, updates);

    if (!user) {
      return json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        userType: user.userType,
        isPaid: user.isPaid,
        apiPermissions: user.apiPermissions
      }
    });
  } catch (error) {
    console.error('PUT user error:', error);
    return json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update user' },
      { status: error instanceof Error && error.message.includes('Admin') ? 403 : 500 }
    );
  }
};

// DELETE - Remove user
export const DELETE: RequestHandler = async ({ request }) => {
  try {
    await requireAdmin(request);
    const { userId } = await request.json();

    if (!userId) {
      return json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    const deleted = await userService.deleteUser(userId);

    if (!deleted) {
      return json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Also delete user's sessions
    await userService.deleteUserSessions(userId);

    return json({ success: true });
  } catch (error) {
    console.error('DELETE user error:', error);
    return json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete user' },
      { status: error instanceof Error && error.message.includes('Admin') ? 403 : 500 }
    );
  }
};
