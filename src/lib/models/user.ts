// User Model and Types
import { ObjectId, type Db } from 'mongodb';

export type UserType = 'admin' | 'premium' | 'freetier';

export interface ApiPermissions {
  cover_letter: boolean;
  resume: boolean;
  questionAndAnswers: boolean;
  upload: boolean;
  jobs: boolean;
}

export interface User {
  _id?: ObjectId;
  email: string;
  name: string;
  password?: string; // Hashed password for email/password auth
  passwordResetToken?: string;
  passwordResetExpiry?: Date;
  userType: UserType;
  isPaid: boolean;
  apiPermissions: ApiPermissions;
  
  // Token Management
  tokenBalance?: number;              // Current available tokens (default: 0)
  totalTokensPurchased?: number;      // Lifetime tokens purchased (default: 0)
  totalTokensUsed?: number;           // Lifetime tokens consumed (default: 0)
  
  // Subscription Plan (for display/pricing)
  currentPlan?: 'silver' | 'gold' | 'diamond' | null;
  planExpiresAt?: Date;              // Optional: if plans have expiry
  
  // Payment & Billing
  stripeCustomerId?: string;         // Stripe customer ID
  defaultPaymentMethodId?: string;  // Default payment method
  
  // Metadata
  lastTokenPurchaseAt?: Date;
  lastTokenUsageAt?: Date;
  
  createdAt: Date;
  lastLogin: Date;
}

export class UserModel {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async create(userData: Omit<User, '_id' | 'createdAt' | 'lastLogin'>): Promise<User> {
    const user: User = {
      ...userData,
      tokenBalance: userData.tokenBalance ?? 0,
      totalTokensPurchased: userData.totalTokensPurchased ?? 0,
      totalTokensUsed: userData.totalTokensUsed ?? 0,
      createdAt: new Date(),
      lastLogin: new Date()
    };

    const result = await this.db.collection<User>('users').insertOne(user);
    return { ...user, _id: result.insertedId };
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.db.collection<User>('users').findOne({ email });
  }

  async findById(id: string | ObjectId): Promise<User | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return await this.db.collection<User>('users').findOne({ _id: objectId });
  }

  async updateLastLogin(userId: string | ObjectId): Promise<void> {
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    await this.db.collection<User>('users').updateOne(
      { _id: objectId },
      { $set: { lastLogin: new Date() } }
    );
  }

  async updateUserType(userId: string | ObjectId, userType: UserType, isPaid: boolean): Promise<void> {
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    await this.db.collection<User>('users').updateOne(
      { _id: objectId },
      { $set: { userType, isPaid } }
    );
  }

  async updateApiPermissions(userId: string | ObjectId, permissions: Partial<ApiPermissions>): Promise<void> {
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    await this.db.collection<User>('users').updateOne(
      { _id: objectId },
      { $set: { apiPermissions: permissions } }
    );
  }

  async listAll(): Promise<User[]> {
    return await this.db.collection<User>('users').find().toArray();
  }

  async delete(userId: string | ObjectId): Promise<boolean> {
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const result = await this.db.collection<User>('users').deleteOne({ _id: objectId });
    return result.deletedCount > 0;
  }

  async updatePassword(userId: string | ObjectId, hashedPassword: string): Promise<void> {
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    await this.db.collection<User>('users').updateOne(
      { _id: objectId },
      { $set: { password: hashedPassword } }
    );
  }

  async setPasswordResetToken(email: string, token: string, expiry: Date): Promise<void> {
    await this.db.collection<User>('users').updateOne(
      { email },
      { $set: { passwordResetToken: token, passwordResetExpiry: expiry } }
    );
  }

  async findByResetToken(token: string): Promise<User | null> {
    return await this.db.collection<User>('users').findOne({
      passwordResetToken: token,
      passwordResetExpiry: { $gt: new Date() }
    });
  }

  async clearPasswordResetToken(userId: string | ObjectId): Promise<void> {
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    await this.db.collection<User>('users').updateOne(
      { _id: objectId },
      { $unset: { passwordResetToken: '', passwordResetExpiry: '' } }
    );
  }

  // Token management methods
  async getTokenBalance(userId: string | ObjectId): Promise<number> {
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const user = await this.findById(objectId);
    return user?.tokenBalance ?? 0;
  }

  async addTokens(userId: string | ObjectId, amount: number): Promise<void> {
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    await this.db.collection<User>('users').updateOne(
      { _id: objectId },
      { 
        $inc: { 
          tokenBalance: amount,
          totalTokensPurchased: amount
        },
        $set: {
          lastTokenPurchaseAt: new Date()
        }
      }
    );
  }

  async deductTokens(userId: string | ObjectId, amount: number): Promise<boolean> {
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const result = await this.db.collection<User>('users').updateOne(
      { 
        _id: objectId,
        tokenBalance: { $gte: amount }  // Only update if sufficient balance
      },
      { 
        $inc: { 
          tokenBalance: -amount,
          totalTokensUsed: amount
        },
        $set: {
          lastTokenUsageAt: new Date()
        }
      }
    );
    return result.modifiedCount > 0;
  }

  async updateTokenBalance(userId: string | ObjectId, balance: number): Promise<void> {
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    await this.db.collection<User>('users').updateOne(
      { _id: objectId },
      { $set: { tokenBalance: balance } }
    );
  }

  async setStripeCustomerId(userId: string | ObjectId, customerId: string): Promise<void> {
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    await this.db.collection<User>('users').updateOne(
      { _id: objectId },
      { $set: { stripeCustomerId: customerId } }
    );
  }

  async setCurrentPlan(userId: string | ObjectId, plan: 'silver' | 'gold' | 'diamond' | null, expiresAt?: Date): Promise<void> {
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const update: any = { currentPlan: plan };
    if (expiresAt) {
      update.planExpiresAt = expiresAt;
    }
    await this.db.collection<User>('users').updateOne(
      { _id: objectId },
      { $set: update }
    );
  }

  // Default permissions based on user type
  static getDefaultPermissions(userType: UserType): ApiPermissions {
    switch (userType) {
      case 'admin':
        return {
          cover_letter: true,
          resume: true,
          questionAndAnswers: true,
          upload: true,
          jobs: true
        };
      case 'premium':
        return {
          cover_letter: true,
          resume: true,
          questionAndAnswers: true,
          upload: true,
          jobs: true
        };
      case 'freetier':
        return {
          cover_letter: true,
          resume: false,
          questionAndAnswers: false,
          upload: true,
          jobs: true
        };
    }
  }
}
