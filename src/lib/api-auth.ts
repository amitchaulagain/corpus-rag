// API Authentication and Authorization

import type { ApiKey, TokenInfo, ApiScope } from './api-types.js';
import { browser } from '$app/environment';

// Browser-safe crypto functions
async function generateRandomBytes(length: number): Promise<string> {
  if (browser) {
    // Use Web Crypto API in browser
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  } else {
    // Use dynamic import for Node.js crypto in server
    const { randomBytes } = await import('crypto');
    return randomBytes(length).toString('hex');
  }
}

async function createHashString(data: string): Promise<string> {
  if (browser) {
    // Simple hash for browser (not cryptographically secure, but sufficient for rate limiting)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  } else {
    // Use dynamic import for Node.js crypto in server
    const { createHash } = await import('crypto');
    return createHash('sha256').update(data).digest('hex');
  }
}

export class ApiAuth {
  private static apiKeys: Map<string, ApiKey> = new Map();
  private static userSessions: Map<string, TokenInfo> = new Map();

  // Generate a new API key
  static async generateApiKey(userId: string, name: string, scopes: ApiScope[]): Promise<ApiKey> {
    const keyId = await generateRandomBytes(16);
    const keySecret = await generateRandomBytes(32);
    const apiKey = `rag_${keyId}_${keySecret}`;

    const keyInfo: ApiKey = {
      id: keyId,
      key: apiKey,
      userId,
      name,
      scopes,
      createdAt: new Date().toISOString(),
      isActive: true
    };

    this.apiKeys.set(apiKey, keyInfo);
    return keyInfo;
  }

  // Validate API key and return user info
  static validateApiKey(apiKey: string): ApiKey | null {
    const keyInfo = this.apiKeys.get(apiKey);
    if (!keyInfo || !keyInfo.isActive) {
      return null;
    }

    // Update last used timestamp
    keyInfo.lastUsed = new Date().toISOString();
    return keyInfo;
  }

  // Check if API key has required scope
  static hasScope(apiKey: ApiKey, requiredScope: ApiScope): boolean {
    return apiKey.scopes.includes(requiredScope) || apiKey.scopes.includes('admin');
  }

  // Create session token for OAuth flow
  static createSession(userId: string, email: string, scopes: ApiScope[]): string {
    const sessionId = generateRandomBytes(32);
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

    const tokenInfo: TokenInfo = {
      userId,
      email,
      scopes,
      expiresAt
    };

    this.userSessions.set(sessionId, tokenInfo);
    return sessionId;
  }

  // Validate session token
  static validateSession(sessionToken: string): TokenInfo | null {
    const tokenInfo = this.userSessions.get(sessionToken);
    if (!tokenInfo || tokenInfo.expiresAt < Date.now()) {
      if (tokenInfo) {
        this.userSessions.delete(sessionToken);
      }
      return null;
    }
    return tokenInfo;
  }

  // Revoke API key
  static revokeApiKey(apiKey: string): boolean {
    const keyInfo = this.apiKeys.get(apiKey);
    if (keyInfo) {
      keyInfo.isActive = false;
      return true;
    }
    return false;
  }

  // Get all API keys for a user
  static getUserApiKeys(userId: string): ApiKey[] {
    return Array.from(this.apiKeys.values())
      .filter(key => key.userId === userId)
      .map(key => ({ ...key, key: this.maskApiKey(key.key) })); // Mask the actual key
  }

  // Mask API key for display
  private static maskApiKey(apiKey: string): string {
    if (apiKey.length <= 12) return apiKey;
    return apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4);
  }

  // Initialize with some default API keys (for development)
  static async initialize() {
    // Create a default admin API key for testing
    const adminKey = await this.generateApiKey(
      'admin@test.com',
      'Development Admin Key',
      ['admin']
    );
    console.log('🔑 Admin API Key created:', adminKey.key);

    // Create a regular user API key for testing
    const userKey = await this.generateApiKey(
      'user@test.com',
      'Development User Key',
      ['files:read', 'files:write', 'corpus:read', 'rag:query', 'rag:import']
    );
    console.log('🔑 User API Key created:', userKey.key);
  }
}

// Rate limiting
export class RateLimit {
  private static limits: Map<string, { count: number; resetTime: number }> = new Map();

  static async check(apiKey: string, limit = 100, windowSeconds = 3600): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const key = await createHashString(apiKey);

    const current = this.limits.get(key);

    if (!current || now > current.resetTime) {
      // Reset or initialize
      const resetTime = now + windowMs;
      this.limits.set(key, { count: 1, resetTime });
      return { allowed: true, remaining: limit - 1, resetTime };
    }

    if (current.count >= limit) {
      return { allowed: false, remaining: 0, resetTime: current.resetTime };
    }

    current.count++;
    return { allowed: true, remaining: limit - current.count, resetTime: current.resetTime };
  }
}

// Middleware types for SvelteKit
export interface AuthenticatedRequest {
  user: {
    id: string;
    email: string;
    scopes: ApiScope[];
  };
  apiKey?: ApiKey;
  rateLimit: {
    remaining: number;
    resetTime: number;
  };
}