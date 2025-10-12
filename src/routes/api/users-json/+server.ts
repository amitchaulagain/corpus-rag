// User CRUD operations with MongoDB
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/db/mongodb';
import { UserModel } from '$lib/models/user';
import { SessionModel } from '$lib/models/session';

// Helper to verify admin auth
async function requireAdmin(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing authorization');
  }

  const db = await getDB();
  const sessionModel = new SessionModel(db);
  const userModel = new UserModel(db);

  const token = authHeader.substring(7);
  const session = await sessionModel.findByToken(token);
  if (!session) {
    throw new Error('Invalid or expired session');
  }

  const user = await userModel.findById(session.userId);
  if (!user || user.userType !== 'admin') {
    throw new Error('Admin access required');
  }

  return { user, session };
}

// GET - List all users
export const GET: RequestHandler = async ({ request }) => {
  try {
    await requireAdmin(request);
    const db = await getDB();
    const userModel = new UserModel(db);
    const users = await userModel.listAll();

    return json({
      success: true,
      users: users.map(u => ({
        id: u._id,
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

    const db = await getDB();
    const userModel = new UserModel(db);

    // Check if user already exists
    const existing = await userModel.findByEmail(email);
    if (existing) {
      return json(
        { success: false, error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    const user = await userModel.create({
      email,
      name,
      userType: userType || 'freetier',
      isPaid: isPaid || false,
      apiPermissions: UserModel.getDefaultPermissions(userType || 'freetier')
    });

    return json({
      success: true,
      user: {
        id: user._id,
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

    const db = await getDB();
    const userModel = new UserModel(db);

    // Update user type if provided
    if (userType !== undefined && isPaid !== undefined) {
      await userModel.updateUserType(id, userType, isPaid);
    }

    // Update API permissions if provided
    if (apiPermissions !== undefined) {
      await userModel.updateApiPermissions(id, apiPermissions);
    }

    // Update name if provided
    if (name !== undefined) {
      await userModel.findById(id); // This doesn't update, need to add update method
    }

    const user = await userModel.findById(id);

    if (!user) {
      return json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return json({
      success: true,
      user: {
        id: user._id,
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

    const db = await getDB();
    const userModel = new UserModel(db);
    const sessionModel = new SessionModel(db);

    const deleted = await userModel.delete(userId);

    if (!deleted) {
      return json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Also delete user's sessions
    await sessionModel.deleteAllForUser(userId);

    return json({ success: true });
  } catch (error) {
    console.error('DELETE user error:', error);
    return json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete user' },
      { status: error instanceof Error && error.message.includes('Admin') ? 403 : 500 }
    );
  }
};
