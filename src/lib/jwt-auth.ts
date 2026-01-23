// JWT Authentication Utilities
import jwt from 'jsonwebtoken';
import type { ApiScope } from './api-types';
import type { UserType } from './models/user';

// Re-export ApiScope for convenience
export type { ApiScope } from './api-types';

const JWT_SECRET: string = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const JWT_ACCESS_EXPIRY: string = process.env.JWT_ACCESS_EXPIRY || '15m';
const JWT_REFRESH_EXPIRY: string = process.env.JWT_REFRESH_EXPIRY || '30d';
const JWT_ISSUER: string = process.env.JWT_ISSUER || 'corpus-rag-api';

export interface AccessTokenPayload {
  sub: string;           // userId
  email: string;
  type: 'access';
  userType: UserType;
  scopes: ApiScope[];
  // RBAC fields
  roles?: string[];                  // All active roles
  departments?: string[];            // Department IDs
  primaryDepartment?: string;
  permissions?: string[];             // Flattened permissions (resource:action:scope)
  isAgent?: boolean;                 // Is user an agent
  agentId?: string;                  // Agent ID if applicable
  iat: number;
  exp: number;
  jti: string;
  iss: string;
}

export interface RefreshTokenPayload {
  sub: string;           // userId
  type: 'refresh';
  tokenFamily: string;
  iat: number;
  exp: number;
  jti: string;
  iss: string;
}

export interface ServiceAccountTokenPayload {
  sub: string;           // serviceAccountId
  type: 'service';
  scopes: ApiScope[];
  iat: number;
  exp: number;
  jti: string;
  iss: string;
}

export class JwtAuth {
  // Generate access token
  static generateAccessToken(
    userId: string,
    email: string,
    userType: UserType,
    scopes: ApiScope[],
    rbacData?: {
      roles?: string[];
      departments?: string[];
      primaryDepartment?: string;
      permissions?: string[];
      isAgent?: boolean;
      agentId?: string;
    }
  ): { token: string; jti: string; expiresIn: number } {
    const jti = this.generateJti();

    const payload: Record<string, any> = {
      sub: userId,
      email,
      type: 'access',
      userType,
      scopes,
      ...(rbacData && {
        roles: rbacData.roles,
        departments: rbacData.departments,
        primaryDepartment: rbacData.primaryDepartment,
        permissions: rbacData.permissions,
        isAgent: rbacData.isAgent,
        agentId: rbacData.agentId
      }),
      jti
    };

    const token = jwt.sign(payload as object, JWT_SECRET, {
      expiresIn: JWT_ACCESS_EXPIRY,
      issuer: JWT_ISSUER
    } as jwt.SignOptions);

    const decoded = jwt.decode(token) as AccessTokenPayload;
    const expiresIn = decoded.exp - decoded.iat;

    return { token, jti, expiresIn };
  }

  // Generate refresh token
  static generateRefreshToken(
    userId: string,
    tokenFamily?: string
  ): { token: string; jti: string; tokenFamily: string; expiresAt: Date } {
    const jti = this.generateJti();
    const family = tokenFamily || this.generateJti();

    const payload: Record<string, any> = {
      sub: userId,
      type: 'refresh',
      tokenFamily: family,
      jti
    };

    const token = jwt.sign(payload as object, JWT_SECRET, {
      expiresIn: JWT_REFRESH_EXPIRY,
      issuer: JWT_ISSUER
    } as jwt.SignOptions);

    const decoded = jwt.decode(token) as RefreshTokenPayload;
    const expiresAt = new Date(decoded.exp * 1000);

    return { token, jti, tokenFamily: family, expiresAt };
  }

  // Generate service account token
  static generateServiceAccountToken(
    serviceAccountId: string,
    scopes: ApiScope[]
  ): { token: string; jti: string; expiresIn: number } {
    const jti = this.generateJti();

    const payload: Record<string, any> = {
      sub: serviceAccountId,
      type: 'service',
      scopes,
      jti
    };

    const token = jwt.sign(payload as object, JWT_SECRET, {
      expiresIn: JWT_ACCESS_EXPIRY,
      issuer: JWT_ISSUER
    } as jwt.SignOptions);

    const decoded = jwt.decode(token) as ServiceAccountTokenPayload;
    const expiresIn = decoded.exp - decoded.iat;

    return { token, jti, expiresIn };
  }

  // Verify and decode token
  static verifyToken(token: string): AccessTokenPayload | RefreshTokenPayload | ServiceAccountTokenPayload {
    try {
      return jwt.verify(token, JWT_SECRET, {
        issuer: JWT_ISSUER
      }) as AccessTokenPayload | RefreshTokenPayload | ServiceAccountTokenPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }

  // Decode without verification (for debugging)
  static decodeToken(token: string): any {
    return jwt.decode(token);
  }

  // Check if token is expired
  static isExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.exp) return true;
      return Date.now() >= decoded.exp * 1000;
    } catch {
      return true;
    }
  }

  // Generate unique JWT ID
  private static generateJti(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
