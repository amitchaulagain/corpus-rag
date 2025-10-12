// API Authentication and Authorization
// Now uses MongoDB for persistent API key storage

import type { ApiScope } from './api-types.js';
import { browser } from '$app/environment';
import { getDB } from './db/mongodb.js';
import { ApiKeyModel } from './models/api-key.js';

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
  // Generate a new API key (now stored in MongoDB)
  static async generateApiKey(userId: string, name: string, scopes: ApiScope[], expiresInDays?: number) {
    const db = await getDB();
    const apiKeyModel = new ApiKeyModel(db);

    return await apiKeyModel.create(userId, name, scopes, expiresInDays);
  }

  // Validate API key and return user info (now from MongoDB)
  static async validateApiKey(apiKey: string) {
    const db = await getDB();
    const apiKeyModel = new ApiKeyModel(db);

    return await apiKeyModel.validate(apiKey);
  }

  // Check if API key has required scope
  static hasScope(apiKey: any, requiredScope: ApiScope): boolean {
    if (!apiKey || !apiKey.scopes) return false;
    return apiKey.scopes.includes(requiredScope) || apiKey.scopes.includes('admin');
  }

  // Revoke API key (now in MongoDB)
  static async revokeApiKey(keyId: string): Promise<boolean> {
    const db = await getDB();
    const apiKeyModel = new ApiKeyModel(db);

    return await apiKeyModel.revoke(keyId);
  }

  // Get all API keys for a user (now from MongoDB)
  static async getUserApiKeys(userId: string) {
    const db = await getDB();
    const apiKeyModel = new ApiKeyModel(db);

    const keys = await apiKeyModel.findByUserId(userId);

    // Return with masked keys for display
    return keys.map(key => ({
      ...key,
      keyDisplay: key.keyPrefix + '...' // Show only prefix
    }));
  }

  // Get all API keys (admin function, now from MongoDB)
  static async getAllApiKeys() {
    const db = await getDB();
    const apiKeyModel = new ApiKeyModel(db);

    return await apiKeyModel.findAll();
  }

  // Initialize with some default API keys (for development)
  static async initialize() {
    // console.log('🔑 API key system initialized with MongoDB storage');
    // console.log('💡 Use /api/auth/keys endpoint to create API keys');
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
  apiKey?: any;
  rateLimit: {
    remaining: number;
    resetTime: number;
  };
}
