// Verify session token and return user info
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/db/mongodb';
import { SessionModel } from '$lib/models/session';
import { UserModel } from '$lib/models/user';

export const GET: RequestHandler = async ({ request }) => {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return json(
        { success: false, error: 'No token provided' },
        { status: 401 }
      );
    }

    const db = await getDB();
    const sessionModel = new SessionModel(db);
    const userModel = new UserModel(db);

    // Find session
    const session = await sessionModel.findByToken(token);
    if (!session) {
      return json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Find user
    const user = await userModel.findById(session.userId);
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
        picture: user.picture,
        userType: user.userType,
        isPaid: user.isPaid,
        apiPermissions: user.apiPermissions
      }
    });

  } catch (error) {
    console.error('Verify error:', error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Verification failed'
      },
      { status: 500 }
    );
  }
};
