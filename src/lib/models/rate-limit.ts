// Rate Limit Model - Persistent rate limiting in MongoDB
import { ObjectId, type Db } from 'mongodb';

export type RateLimitIdentifierType = 'user' | 'service_account';

export interface RateLimitRecord {
  _id?: ObjectId;
  identifier: string;
  identifierType: RateLimitIdentifierType;
  windowStart: Date;
  windowEnd: Date;
  requestCount: number;
  limit: number;
  lastReset: Date;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  requestCount: number;
}

export class RateLimitModel {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async check(
    identifier: string,
    identifierType: RateLimitIdentifierType,
    limit: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + windowSeconds * 1000);

    // Atomic increment with upsert
    const result = await this.db.collection<RateLimitRecord>('rate_limits').findOneAndUpdate(
      {
        identifier,
        identifierType,
        windowEnd: { $gt: now }
      },
      {
        $inc: { requestCount: 1 },
        $setOnInsert: {
          windowStart: now,
          windowEnd,
          limit,
          lastReset: now
        }
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    );

    if (!result) {
      throw new Error('Failed to update rate limit');
    }

    const allowed = result.requestCount <= limit;
    const remaining = Math.max(0, limit - result.requestCount);

    return {
      allowed,
      remaining,
      resetTime: result.windowEnd,
      requestCount: result.requestCount
    };
  }

  async reset(identifier: string, identifierType: RateLimitIdentifierType): Promise<boolean> {
    const result = await this.db.collection<RateLimitRecord>('rate_limits').deleteOne({
      identifier,
      identifierType
    });
    return result.deletedCount > 0;
  }

  async getStatus(identifier: string, identifierType: RateLimitIdentifierType): Promise<RateLimitRecord | null> {
    return await this.db.collection<RateLimitRecord>('rate_limits').findOne({
      identifier,
      identifierType,
      windowEnd: { $gt: new Date() }
    });
  }

  // Cleanup expired windows
  async cleanupExpired(): Promise<number> {
    const result = await this.db.collection<RateLimitRecord>('rate_limits').deleteMany({
      windowEnd: { $lt: new Date() }
    });
    return result.deletedCount;
  }

  // Create indexes
  async createIndexes(): Promise<void> {
    await this.db.collection('rate_limits').createIndex(
      { identifier: 1, identifierType: 1, windowEnd: 1 },
      { unique: true }
    );
    await this.db.collection('rate_limits').createIndex({ windowEnd: 1 });
  }
}
