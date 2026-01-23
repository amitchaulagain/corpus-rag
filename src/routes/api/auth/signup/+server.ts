// Email/Password Signup
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/db/mongodb.js';
import { UserModel, type UserType } from '$lib/models/user.js';
import { SessionModel } from '$lib/models/session.js';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

// Hosts allowed for auto-admin promotion
const ALLOWED_HOSTS = ['localhost', 'localhost:3000', 'onlyforthedevs.inquisitivemind.tech'];

export const POST: RequestHandler = async ({ request, cookies, url }) => {
  try {
    const { email, password, name } = await request.json();

    // Validation
    if (!email || !email.includes('@')) {
      return json({ success: false, error: 'Valid email is required' }, { status: 400 });
    }

    if (!password || password.length < 8) {
      return json({ success: false, error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const db = await getDB();
    const userModel = new UserModel(db);
    const sessionModel = new SessionModel(db);

    // Check if user already exists
    const existingUser = await userModel.findByEmail(email);
    if (existingUser) {
      return json({ success: false, error: 'User with this email already exists' }, { status: 409 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Check for auto-admin promotion: email starts with "admin@" and request from allowed host
    const emailLocalPart = email.split('@')[0].toLowerCase();
    const requestHost = url.host || request.headers.get('host') || '';
    const isAllowedHost = ALLOWED_HOSTS.some(h => requestHost.includes(h));
    const isAdminEmail = emailLocalPart === 'admin';

    const userType: UserType = (isAdminEmail && isAllowedHost) ? 'admin' : 'freetier';
    const isPaid = userType === 'admin';

    // Create user
    const user = await userModel.create({
      email,
      password: hashedPassword,
      name: name || email.split('@')[0],
      userType,
      isPaid,
      apiPermissions: UserModel.getDefaultPermissions(userType)
    });

    console.log(`Created new user: ${email} (${userType}${isAdminEmail && isAllowedHost ? ' - auto-promoted' : ''})`);

    // Create session
    if (!user._id) {
      return json({ success: false, error: 'User creation failed' }, { status: 500 });
    }
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
    console.error('Signup error:', error);
    return json(
      { success: false, error: error.message || 'Signup failed' },
      { status: 500 }
    );
  }
};
