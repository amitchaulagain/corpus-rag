// API Key Model
import { ObjectId, type Db } from 'mongodb';

export type ApiScope = 'admin' | 'cover_letter' | 'resume' | 'questionAndAnswers' | 'upload' | 'jobs';

export interface ApiKey {
  _id?: ObjectId;
  userId: ObjectId;
  keyHash: string; // SHA256 hash of the actual key
  keyPrefix: string; // First 8 chars for display (e.g., "rag_abc1")
  name: string;
  scopes: ApiScope[];
  isActive: boolean;
  createdAt: Date;
  lastUsed?: Date;
  expiresAt?: Date; // Optional expiration
}

export class ApiKeyModel {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  // Generate a new API key
  async create(userId: string | ObjectId, name: string, scopes: ApiScope[], expiresInDays?: number): Promise<{ key: string; keyInfo: ApiKey }> {
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    // Dynamic import for crypto (server-side only)
    const { randomBytes, createHash } = await import('crypto');

    // Generate random key: rag_<16-char-id>_<32-char-secret>
    const keyId = randomBytes(8).toString('hex');
    const keySecret = randomBytes(16).toString('hex');
    const apiKey = `rag_${keyId}_${keySecret}`;

    // Hash the key for storage
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const keyPrefix = apiKey.substring(0, 12); // "rag_abc12345"

    const keyInfo: ApiKey = {
      userId: userObjectId,
      keyHash,
      keyPrefix,
      name,
      scopes,
      isActive: true,
      createdAt: new Date(),
      expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : undefined
    };

    const result = await this.db.collection<ApiKey>('api_keys').insertOne(keyInfo);

    return {
      key: apiKey, // Return the actual key ONCE (user must save it)
      keyInfo: { ...keyInfo, _id: result.insertedId }
    };
  }

  // Validate API key and return key info
  async validate(apiKey: string): Promise<ApiKey | null> {
    // Dynamic import for crypto (server-side only)
    const { createHash } = await import('crypto');

    // Hash the provided key
    const keyHash = createHash('sha256').update(apiKey).digest('hex');

    // Find by hash
    const keyInfo = await this.db.collection<ApiKey>('api_keys').findOne({
      keyHash,
      isActive: true,
      $or: [
        { expiresAt: { $exists: false } }, // No expiration
        { expiresAt: { $gt: new Date() } }  // Not expired
      ]
    });

    if (!keyInfo) {
      return null;
    }

    // Update last used timestamp
    await this.db.collection<ApiKey>('api_keys').updateOne(
      { _id: keyInfo._id },
      { $set: { lastUsed: new Date() } }
    );

    return keyInfo;
  }

  // Check if API key has required scope
  hasScope(apiKey: ApiKey, requiredScope: ApiScope): boolean {
    return apiKey.scopes.includes(requiredScope) || apiKey.scopes.includes('admin');
  }

  // Revoke API key
  async revoke(keyId: string | ObjectId): Promise<boolean> {
    const objectId = typeof keyId === 'string' ? new ObjectId(keyId) : keyId;

    const result = await this.db.collection<ApiKey>('api_keys').updateOne(
      { _id: objectId },
      { $set: { isActive: false } }
    );

    return result.modifiedCount > 0;
  }

  // Get all API keys for a user (with masked keys)
  async findByUserId(userId: string | ObjectId): Promise<ApiKey[]> {
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    return await this.db.collection<ApiKey>('api_keys')
      .find({ userId: userObjectId })
      .sort({ createdAt: -1 })
      .toArray();
  }

  // Get all API keys (admin function)
  async findAll(): Promise<ApiKey[]> {
    return await this.db.collection<ApiKey>('api_keys')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
  }

  // Delete API key permanently
  async delete(keyId: string | ObjectId): Promise<boolean> {
    const objectId = typeof keyId === 'string' ? new ObjectId(keyId) : keyId;

    const result = await this.db.collection<ApiKey>('api_keys').deleteOne({ _id: objectId });
    return result.deletedCount > 0;
  }

  // Update API key scopes
  async updateScopes(keyId: string | ObjectId, scopes: ApiScope[]): Promise<boolean> {
    const objectId = typeof keyId === 'string' ? new ObjectId(keyId) : keyId;

    const result = await this.db.collection<ApiKey>('api_keys').updateOne(
      { _id: objectId },
      { $set: { scopes } }
    );

    return result.modifiedCount > 0;
  }

  // Cleanup expired keys
  async deleteExpired(): Promise<number> {
    const result = await this.db.collection<ApiKey>('api_keys').deleteMany({
      expiresAt: { $lt: new Date() }
    });

    return result.deletedCount;
  }
}
