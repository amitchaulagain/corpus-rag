// Email/Password Login
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/db/mongodb.js';
import { UserModel } from '$lib/models/user.js';
import { SessionModel } from '$lib/models/session.js';
import bcrypt from 'bcrypt';

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const { email, password } = await request.json();

    // Validation
    if (!email || !email.includes('@')) {
      return json({ success: false, error: 'Valid email is required' }, { status: 400 });
    }

    if (!password) {
      return json({ success: false, error: 'Password is required' }, { status: 400 });
    }

    const db = await getDB();
    const userModel = new UserModel(db);
    const sessionModel = new SessionModel(db);

    // Find user
    const user = await userModel.findByEmail(email);
    if (!user) {
      return json({ success: false, error: 'Invalid email or password' }, { status: 401 });
    }

    // Check if user has a password (might be Google-only user)
    if (!user.password) {
      return json({ success: false, error: 'This account uses Google Sign-In. Please login with Google.' }, { status: 401 });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return json({ success: false, error: 'Invalid email or password' }, { status: 401 });
    }

    // Update last login
    if (!user._id) {
      return json({ success: false, error: 'User ID not found' }, { status: 500 });
    }
    await userModel.updateLastLogin(user._id);

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
