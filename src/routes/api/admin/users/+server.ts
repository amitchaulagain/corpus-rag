// Admin: Manage users
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/db/mongodb';
import { UserModel, type UserType, type ApiPermissions } from '$lib/models/user';
import { requireAdmin } from '$lib/auth-middleware';

// GET - List all users
export const GET: RequestHandler = async (event) => {
  try {
    await requireAdmin(event);

    const db = await getDB();
    const userModel = new UserModel(db);

    const users = await userModel.listAll();

    return json({
      success: true,
      users: users.map(u => ({
        id: u._id,
        email: u.email,
        name: u.name,
        userType: u.userType,
        isPaid: u.isPaid,
        apiPermissions: u.apiPermissions,
        createdAt: u.createdAt,
        lastLogin: u.lastLogin
      }))
    });

  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list users'
      },
      { status: error instanceof Error && error.message.includes('Admin') ? 403 : 500 }
    );
  }
};

// PUT - Update user type/permissions
export const PUT: RequestHandler = async (event) => {
  try {
    await requireAdmin(event);

    const { userId, userType, isPaid, apiPermissions } = await event.request.json();

    if (!userId) {
      return json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    const db = await getDB();
    const userModel = new UserModel(db);

    // Update user type if provided
    if (userType !== undefined && isPaid !== undefined) {
      await userModel.updateUserType(userId, userType as UserType, isPaid);
    }

    // Update API permissions if provided
    if (apiPermissions) {
      await userModel.updateApiPermissions(userId, apiPermissions as Partial<ApiPermissions>);
    }

    // Get updated user
    const user = await userModel.findById(userId);

    return json({
      success: true,
      user: {
        id: user?._id,
        email: user?.email,
        name: user?.name,
        userType: user?.userType,
        isPaid: user?.isPaid,
        apiPermissions: user?.apiPermissions
      }
    });

  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update user'
      },
      { status: error instanceof Error && error.message.includes('Admin') ? 403 : 500 }
    );
  }
};

// DELETE - Delete user
export const DELETE: RequestHandler = async (event) => {
  try {
    await requireAdmin(event);

    const { userId } = await event.request.json();

    if (!userId) {
      return json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    const db = await getDB();
    const userModel = new UserModel(db);

    const deleted = await userModel.delete(userId);

    if (!deleted) {
      return json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete user'
      },
      { status: error instanceof Error && error.message.includes('Admin') ? 403 : 500 }
    );
  }
};
