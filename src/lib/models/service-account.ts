// Service Account Model
import { ObjectId, type Db } from 'mongodb';
import type { ApiScope } from '../api-types';

export interface ServiceAccount {
  _id?: ObjectId;
  name: string;
  clientId: string;
  clientSecretHash: string;
  scopes: ApiScope[];
  createdBy: ObjectId;
  isActive: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
  rateLimit: {
    requestsPerHour: number;
    requestsPerDay: number;
  };
}

export class ServiceAccountModel {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async create(
    name: string,
    scopes: ApiScope[],
    createdBy: string | ObjectId,
    rateLimit?: { requestsPerHour: number; requestsPerDay: number }
  ): Promise<{ account: ServiceAccount; clientId: string; clientSecret: string }> {
    const createdByObjectId = typeof createdBy === 'string' ? new ObjectId(createdBy) : createdBy;

    // Dynamic import for crypto
    const { randomBytes, createHash } = await import('crypto');

    // Generate credentials
    const clientId = randomBytes(16).toString('hex');
    const clientSecret = randomBytes(32).toString('base64url');
    const clientSecretHash = createHash('sha256').update(clientSecret).digest('hex');

    const account: ServiceAccount = {
      name,
      clientId,
      clientSecretHash,
      scopes,
      createdBy: createdByObjectId,
      isActive: true,
      createdAt: new Date(),
      rateLimit: rateLimit || {
        requestsPerHour: 5000,
        requestsPerDay: 50000
      }
    };

    const result = await this.db.collection<ServiceAccount>('service_accounts').insertOne(account);

    return {
      account: { ...account, _id: result.insertedId },
      clientId,
      clientSecret // Return ONCE - must be stored by user
    };
  }

  async findByClientId(clientId: string): Promise<ServiceAccount | null> {
    return await this.db.collection<ServiceAccount>('service_accounts').findOne({
      clientId,
      isActive: true
    });
  }

  async validateCredentials(clientId: string, clientSecret: string): Promise<ServiceAccount | null> {
    const { createHash } = await import('crypto');
    const clientSecretHash = createHash('sha256').update(clientSecret).digest('hex');

    const account = await this.db.collection<ServiceAccount>('service_accounts').findOne({
      clientId,
      clientSecretHash,
      isActive: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } }
      ]
    });

    if (account) {
      // Update last used
      await this.db.collection<ServiceAccount>('service_accounts').updateOne(
        { _id: account._id },
        { $set: { lastUsedAt: new Date() } }
      );
    }

    return account;
  }

  async revoke(accountId: string | ObjectId): Promise<boolean> {
    const objectId = typeof accountId === 'string' ? new ObjectId(accountId) : accountId;
    const result = await this.db.collection<ServiceAccount>('service_accounts').updateOne(
      { _id: objectId },
      { $set: { isActive: false } }
    );
    return result.modifiedCount > 0;
  }

  async listByUser(userId: string | ObjectId): Promise<ServiceAccount[]> {
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    return await this.db.collection<ServiceAccount>('service_accounts')
      .find({ createdBy: userObjectId })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async listAll(): Promise<ServiceAccount[]> {
    return await this.db.collection<ServiceAccount>('service_accounts')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
  }

  // Create indexes
  async createIndexes(): Promise<void> {
    await this.db.collection('service_accounts').createIndex({ clientId: 1 }, { unique: true });
    await this.db.collection('service_accounts').createIndex({ createdBy: 1 });
    await this.db.collection('service_accounts').createIndex({ isActive: 1 });
  }
}
