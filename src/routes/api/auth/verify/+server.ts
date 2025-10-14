// Web UI session verification (separate from JWT API auth)
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/db/mongodb.js';
import { SessionModel } from '$lib/models/session.js';
import { UserModel } from '$lib/models/user.js';

export const GET: RequestHandler = async ({ request }) => {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return json({ success: false, error: 'No token provided' }, { status: 401 });
    }

    const db = await getDB();
    const sessionModel = new SessionModel(db);
    const userModel = new UserModel(db);

    // Validate session
    const session = await sessionModel.findByToken(token);
    if (!session) {
      return json({ success: false, error: 'Invalid or expired session' }, { status: 401 });
    }

    // Get user
    const user = await userModel.findById(session.userId);
    if (!user) {
      return json({ success: false, error: 'User not found' }, { status: 404 });
    }

    return json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        userType: user.userType,
        isPaid: user.isPaid
      }
    });
  } catch (error: any) {
    console.error('Verify error:', error);
    return json({ success: false, error: 'Verification failed' }, { status: 500 });
  }
};
