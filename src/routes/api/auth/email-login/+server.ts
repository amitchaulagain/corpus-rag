// Simple email-based login (no Google OAuth)
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/db/mongodb.js';
import { UserModel } from '$lib/models/user.js';
import { SessionModel } from '$lib/models/session.js';

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const { email } = await request.json();

    if (!email || !email.includes('@')) {
      return json({ success: false, error: 'Valid email is required' }, { status: 400 });
    }

    const db = await getDB();
    const userModel = new UserModel(db);
    const sessionModel = new SessionModel(db);

    // Find or create user
    let user = await userModel.findByEmail(email);
    if (!user) {
      // Create new user with email
      user = await userModel.create({
        email,
        name: email.split('@')[0], // Use email prefix as name
        userType: 'user', // Default to user, admin can be set manually in database
        isPaid: false
      });
      console.log('Created new user:', email);
    }

    // Create session
    const session = await sessionModel.create(user._id.toString());

    // Set cookie
    cookies.set('session_token', session.token, {
      path: '/',
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 // 30 days
    });

    return json({
      success: true,
      token: session.token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        userType: user.userType,
        isPaid: user.isPaid
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return json(
      { success: false, error: error.message || 'Login failed' },
      { status: 500 }
    );
  }
};
