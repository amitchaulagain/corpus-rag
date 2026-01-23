// Convert session token to JWT access + refresh tokens
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/db/mongodb.js';
import { SessionModel } from '$lib/models/session.js';
import { UserModel } from '$lib/models/user.js';
import { RefreshTokenModel } from '$lib/models/refresh-token.js';
import { JwtAuth, type ApiScope } from '$lib/jwt-auth.js';
import { getUserRoles, getUserPermissions } from '$lib/rbac-middleware.js';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  try {
    const authHeader = request.headers.get('Authorization');
    const sessionToken = authHeader?.replace('Bearer ', '');

    if (!sessionToken) {
      return json({ success: false, error: 'No session token provided' }, { status: 401 });
    }

    const db = await getDB();
    const sessionModel = new SessionModel(db);
    const userModel = new UserModel(db);
    const refreshTokenModel = new RefreshTokenModel(db);

    // Validate session
    const session = await sessionModel.findByToken(sessionToken);
    if (!session) {
      return json({ success: false, error: 'Invalid or expired session' }, { status: 401 });
    }

    // Get user
    const user = await userModel.findById(session.userId);
    if (!user || !user._id) {
      return json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Get scopes based on user permissions (legacy)
    const scopes: ApiScope[] = Object.entries(user.apiPermissions)
      .filter(([_, allowed]) => allowed)
      .map(([scope]) => scope as ApiScope);

    // Get RBAC data
    const roles = await getUserRoles(user._id!);
    const departments = user.departments?.map(d => d.toString()) || [];
    const primaryDepartment = user.primaryDepartmentId?.toString();
    const permissions = await getUserPermissions(user._id!);
    const isAgent = !!user.agentProfile?.isActive;
    const agentId = user.agentProfile?.agentId?.toString();

    // Generate JWT access token with RBAC data
    const accessTokenData = JwtAuth.generateAccessToken(
      user._id!.toString(),
      user.email,
      user.userType,
      scopes,
      {
        roles,
        departments,
        primaryDepartment,
        permissions,
        isAgent,
        agentId
      }
    );

    // Generate JWT refresh token
    const refreshTokenData = JwtAuth.generateRefreshToken(user._id.toString());

    // Store refresh token in database
    await refreshTokenModel.create({
      userId: user._id!,
      tokenFamily: refreshTokenData.tokenFamily,
      jti: refreshTokenData.jti,
      isRevoked: false,
      expiresAt: refreshTokenData.expiresAt,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      userAgent: request.headers.get('user-agent') || undefined,
      ipAddress: getClientAddress()
    });

    return json({
      success: true,
      accessToken: accessTokenData.token,
      refreshToken: refreshTokenData.token,
      expiresIn: accessTokenData.expiresIn,
      user: {
        id: user._id,
        email: user.email,
        userType: user.userType,
        roles,
        departments,
        primaryDepartment,
        isAgent,
        agentId
      }
    });
  } catch (error: any) {
    console.error('Session to JWT error:', error);
    return json({ success: false, error: 'Conversion failed' }, { status: 500 });
  }
};
