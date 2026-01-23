// JWT Refresh Token Endpoint
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/db/mongodb';
import { UserModel } from '$lib/models/user';
import { RefreshTokenModel } from '$lib/models/refresh-token';
import { JwtAuth } from '$lib/jwt-auth';
import type { RefreshTokenPayload } from '$lib/jwt-auth';
import { getUserRoles, getUserPermissions } from '$lib/rbac-middleware.js';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  try {
    const { refreshToken } = await request.json();

    if (!refreshToken) {
      return json({ success: false, error: 'Refresh token required' }, { status: 400 });
    }

    // Verify JWT
    let decoded: RefreshTokenPayload;
    try {
      decoded = JwtAuth.verifyToken(refreshToken) as RefreshTokenPayload;
    } catch (error) {
      return json({
        success: false,
        error: error instanceof Error ? error.message : 'Invalid refresh token'
      }, { status: 401 });
    }

    if (decoded.type !== 'refresh') {
      return json({ success: false, error: 'Invalid token type' }, { status: 401 });
    }

    const db = await getDB();
    const refreshTokenModel = new RefreshTokenModel(db);
    const userModel = new UserModel(db);

    // Check if token exists and is not revoked
    const storedToken = await refreshTokenModel.findByJti(decoded.jti);

    if (!storedToken || storedToken.isRevoked) {
      // Token reuse detected! Revoke entire family
      if (storedToken?.tokenFamily) {
        await refreshTokenModel.revokeFamily(storedToken.tokenFamily);
        console.error('⚠️ Token reuse detected! Revoked family:', storedToken.tokenFamily);
      }
      return json({
        success: false,
        error: 'Token reuse detected - all tokens revoked'
      }, { status: 401 });
    }

    // Get user
    const user = await userModel.findById(decoded.sub);
    if (!user || !user._id) {
      return json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Revoke old refresh token
    await refreshTokenModel.revoke(decoded.jti);

    // Get RBAC data
    const roles = await getUserRoles(user._id);
    const departments = user.departments?.map(d => d.toString()) || [];
    const primaryDepartment = user.primaryDepartmentId?.toString();
    const permissions = await getUserPermissions(user._id);
    const isAgent = !!user.agentProfile?.isActive;
    const agentId = user.agentProfile?.agentId?.toString();

    // Get scopes (legacy)
    const scopes = Object.entries(user.apiPermissions)
      .filter(([_, allowed]) => allowed)
      .map(([scope]) => scope as any);

    // Generate new tokens (rotate refresh token) with RBAC data
    const newAccessToken = JwtAuth.generateAccessToken(
      user._id.toString(),
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

    const newRefreshToken = JwtAuth.generateRefreshToken(
      user._id.toString(),
      decoded.tokenFamily // Keep same family
    );

    // Store new refresh token
    await refreshTokenModel.create({
      userId: user._id,
      tokenFamily: newRefreshToken.tokenFamily,
      jti: newRefreshToken.jti,
      isRevoked: false,
      expiresAt: newRefreshToken.expiresAt,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      userAgent: request.headers.get('user-agent') || undefined,
      ipAddress: getClientAddress()
    });

    return json({
      success: true,
      accessToken: newAccessToken.token,
      refreshToken: newRefreshToken.token,
      expiresIn: newAccessToken.expiresIn
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Refresh failed'
    }, { status: 500 });
  }
};
