// Convert session token to JWT access token (for API docs page)
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/db/mongodb.js';
import { SessionModel } from '$lib/models/session.js';
import { UserModel } from '$lib/models/user.js';
import { JwtAuth, type ApiScope } from '$lib/jwt-auth.js';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const authHeader = request.headers.get('Authorization');
    const sessionToken = authHeader?.replace('Bearer ', '');

    if (!sessionToken) {
      return json({ success: false, error: 'No session token provided' }, { status: 401 });
    }

    const db = await getDB();
    const sessionModel = new SessionModel(db);
    const userModel = new UserModel(db);

    // Validate session
    const session = await sessionModel.findByToken(sessionToken);
    if (!session) {
      return json({ success: false, error: 'Invalid or expired session' }, { status: 401 });
    }

    // Get user
    const user = await userModel.findById(session.userId);
    if (!user) {
      return json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Get scopes based on user type
    const scopes: ApiScope[] = user.userType === 'admin'
      ? ['admin']
      : ['cover_letter', 'resume', 'questionAndAnswers', 'jobs', 'upload'];

    // Generate JWT access token
    const { token: accessToken, expiresIn } = JwtAuth.generateAccessToken(
      user._id.toString(),
      user.email,
      user.userType,
      scopes
    );

    return json({
      success: true,
      accessToken,
      expiresIn,
      user: {
        id: user._id,
        email: user.email,
        userType: user.userType
      }
    });
  } catch (error: any) {
    console.error('Session to JWT error:', error);
    return json({ success: false, error: 'Conversion failed' }, { status: 500 });
  }
};
