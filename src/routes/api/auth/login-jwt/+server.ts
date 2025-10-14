// JWT-based Google OAuth Login
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { OAuth2Client } from 'google-auth-library';
import { getDB } from '$lib/db/mongodb';
import { UserModel } from '$lib/models/user';
import { RefreshTokenModel } from '$lib/models/refresh-token';
import { JwtAuth } from '$lib/jwt-auth';

const CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID || process.env.PUBLIC_GOOGLE_CLIENT_ID;
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'puskarwagle17@gmail.com,achaulagain123@gmail.com').split(',').map(e => e.trim());

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  try {
    const { credential } = await request.json();

    if (!credential) {
      return json({ success: false, error: 'Missing Google credential' }, { status: 400 });
    }

    // Verify Google token
    const client = new OAuth2Client(CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return json({ success: false, error: 'Invalid Google token' }, { status: 401 });
    }

    const db = await getDB();
    const userModel = new UserModel(db);
    const refreshTokenModel = new RefreshTokenModel(db);

    // Find or create user
    let user = await userModel.findByEmail(payload.email);
    if (!user) {
      // Check if the user is an admin
      const isAdmin = ADMIN_EMAILS.includes(payload.email);
      const userType = isAdmin ? 'admin' : 'freetier';
      const isPaid = isAdmin;

      user = await userModel.create({
        email: payload.email,
        googleId: payload.sub,
        name: payload.name || payload.email,
        picture: payload.picture,
        userType: userType,
        isPaid: isPaid,
        apiPermissions: UserModel.getDefaultPermissions(userType)
      });
      console.log(`✅ Created new ${userType} user: ${payload.email}`);
    } else {
      await userModel.updateLastLogin(user._id!);
    }

    // Generate JWT tokens
    const accessToken = JwtAuth.generateAccessToken(
      user._id!.toString(),
      user.email,
      user.userType,
      Object.entries(user.apiPermissions)
        .filter(([_, allowed]) => allowed)
        .map(([scope]) => scope as any)
    );

    const refreshToken = JwtAuth.generateRefreshToken(user._id!.toString());

    // Store refresh token
    await refreshTokenModel.create({
      userId: user._id!,
      tokenFamily: refreshToken.tokenFamily,
      jti: refreshToken.jti,
      isRevoked: false,
      expiresAt: refreshToken.expiresAt,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      userAgent: request.headers.get('user-agent') || undefined,
      ipAddress: getClientAddress()
    });

    console.log(`✅ JWT login successful for: ${user.email}`);

    return json({
      success: true,
      accessToken: accessToken.token,
      refreshToken: refreshToken.token,
      expiresIn: accessToken.expiresIn,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        userType: user.userType,
        isPaid: user.isPaid
      }
    });

  } catch (error) {
    console.error('JWT Login error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Login failed'
    }, { status: 500 });
  }
};
