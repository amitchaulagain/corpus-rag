// Google OAuth Login with MongoDB
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { OAuth2Client } from 'google-auth-library';
import { getDB } from '$lib/db/mongodb';
import { UserModel } from '$lib/models/user';
import { SessionModel } from '$lib/models/session';

const CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID || process.env.PUBLIC_GOOGLE_CLIENT_ID;

// Pre-authorized admin emails
const ADMIN_EMAILS = [
  'puskarwagle17@gmail.com',
  'achaulagain123@gmail.com'
];

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { credential } = await request.json();

    if (!credential) {
      return json(
        { success: false, error: 'Missing Google credential' },
        { status: 400 }
      );
    }

    // Verify Google token
    const client = new OAuth2Client(CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return json(
        { success: false, error: 'Invalid Google token' },
        { status: 401 }
      );
    }

    const db = await getDB();
    const userModel = new UserModel(db);
    const sessionModel = new SessionModel(db);

    // Check if user exists
    let user = await userModel.findByEmail(payload.email);

    if (!user) {
      // Check if email is in pre-authorized admin list
      const isAdminEmail = ADMIN_EMAILS.includes(payload.email);

      if (isAdminEmail) {
        // Create admin user
        user = await userModel.create({
          email: payload.email,
          googleId: payload.sub,
          name: payload.name || payload.email,
          picture: payload.picture,
          userType: 'admin',
          isPaid: true,
          apiPermissions: UserModel.getDefaultPermissions('admin')
        });
      } else {
        // New users not allowed unless added by admin
        return json(
          { success: false, error: 'Access denied. Contact admin to get access.' },
          { status: 403 }
        );
      }
    }

    // Only allow admins to login
    if (user.userType !== 'admin') {
      return json(
        { success: false, error: 'Access denied. Admin only.' },
        { status: 403 }
      );
    }

    // Update last login
    await userModel.updateLastLogin(user._id!);

    // Create session token
    const session = await sessionModel.create(user._id!);

    return json({
      success: true,
      token: session.token,
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
    console.error('Login error:', error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed'
      },
      { status: 500 }
    );
  }
};
