// Google OAuth Login
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { OAuth2Client } from 'google-auth-library';
import { getDB } from '$lib/db/mongodb';
import { UserModel } from '$lib/models/user';
import { SessionModel } from '$lib/models/session';

const CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID || process.env.PUBLIC_GOOGLE_CLIENT_ID;
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'puskarwagle17@gmail.com,achaulagain123@gmail.com').split(',').map(e => e.trim());

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { credential, userInfo } = await request.json();

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

    // Check if email is in admin list
    const isAdmin = ADMIN_EMAILS.includes(payload.email);

    if (!isAdmin) {
      // Reject non-admin users
      console.log(`❌ Login rejected: ${payload.email} is not an admin`);
      return json(
        {
          success: false,
          error: 'Access denied: This application is only accessible to administrators.'
        },
        { status: 403 }
      );
    }

    // Check if user exists
    let user = await userModel.findByEmail(payload.email);

    if (!user) {
      // Create new admin user
      user = await userModel.create({
        email: payload.email,
        googleId: payload.sub,
        name: payload.name || payload.email,
        picture: payload.picture,
        userType: 'admin',
        isPaid: true,
        apiPermissions: UserModel.getDefaultPermissions('admin')
      });

      console.log(`✅ Created new admin user: ${payload.email}`);
    } else {
      // Verify existing user is admin
      if (user.userType !== 'admin') {
        console.log(`❌ Login rejected: ${payload.email} exists but is not an admin`);
        return json(
          {
            success: false,
            error: 'Access denied: Your account does not have administrator privileges.'
          },
          { status: 403 }
        );
      }

      // Update last login
      await userModel.updateLastLogin(user._id!);
    }

    // Create session token
    const session = await sessionModel.create(user._id!, 7 * 24 * 60 * 60 * 1000); // 7 days

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
