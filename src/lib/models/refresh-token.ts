// Refresh Token Model
import { ObjectId, type Db } from 'mongodb';

export interface RefreshToken {
  _id?: ObjectId;
  userId: ObjectId;
  tokenFamily: string;
  jti: string;
  isRevoked: boolean;
  expiresAt: Date;
  createdAt: Date;
  lastUsedAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

export class RefreshTokenModel {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async create(token: Omit<RefreshToken, '_id'>): Promise<RefreshToken> {
    const result = await this.db.collection<RefreshToken>('refresh_tokens').insertOne(token as RefreshToken);
    return { ...token, _id: result.insertedId } as RefreshToken;
  }

  async findByJti(jti: string): Promise<RefreshToken | null> {
    return await this.db.collection<RefreshToken>('refresh_tokens').findOne({ jti });
  }

  async revoke(jti: string): Promise<boolean> {
    const result = await this.db.collection<RefreshToken>('refresh_tokens').updateOne(
      { jti },
      { $set: { isRevoked: true } }
    );
    return result.modifiedCount > 0;
  }

  async revokeFamily(tokenFamily: string): Promise<number> {
    const result = await this.db.collection<RefreshToken>('refresh_tokens').updateMany(
      { tokenFamily },
      { $set: { isRevoked: true } }
    );
    return result.modifiedCount;
  }

  async updateLastUsed(jti: string): Promise<void> {
    await this.db.collection<RefreshToken>('refresh_tokens').updateOne(
      { jti },
      { $set: { lastUsedAt: new Date() } }
    );
  }

  async deleteExpired(): Promise<number> {
    const result = await this.db.collection<RefreshToken>('refresh_tokens').deleteMany({
      expiresAt: { $lt: new Date() }
    });
    return result.deletedCount;
  }

  async deleteAllForUser(userId: string | ObjectId): Promise<number> {
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const result = await this.db.collection<RefreshToken>('refresh_tokens').deleteMany({
      userId: userObjectId
    });
    return result.deletedCount;
  }

  // Create indexes for performance
  async createIndexes(): Promise<void> {
    await this.db.collection('refresh_tokens').createIndex({ jti: 1 }, { unique: true });
    await this.db.collection('refresh_tokens').createIndex({ userId: 1 });
    await this.db.collection('refresh_tokens').createIndex({ tokenFamily: 1 });
    await this.db.collection('refresh_tokens').createIndex({ expiresAt: 1 });
  }
}
