// MongoDB User Service - replaces user-storage.ts
import { connectToDatabase, ObjectId } from './mongodb';
import { randomBytes } from 'crypto';

export type UserType = 'admin' | 'premium' | 'freetier';

export interface User {
  _id?: ObjectId;
  id?: string;
  email: string;
  googleId?: string;
  name: string;
  picture?: string;
  userType: UserType;
  isPaid: boolean;
  apiPermissions: {
    cover_letter: boolean;
    resume: boolean;
    questionAndAnswers: boolean;
    upload: boolean;
    jobs: boolean;
  };
  createdAt: Date;
  lastLogin: Date;
}

export interface Session {
  _id?: ObjectId;
  id?: string;
  userId: string;
  token: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface UsageRecord {
  _id?: ObjectId;
  id?: string;
  userId: string;
  endpoint: string;
  aiProvider: string;
  tokensUsed: number;
  cost: number;
  success: boolean;
  timestamp: Date;
}

export class UserService {
  // Get default permissions based on user type
  static getDefaultPermissions(userType: UserType) {
    if (userType === 'admin') {
      return {
        cover_letter: true,
        resume: true,
        questionAndAnswers: true,
        upload: true,
        jobs: true
      };
    } else if (userType === 'premium') {
      return {
        cover_letter: true,
        resume: true,
        questionAndAnswers: true,
        upload: true,
        jobs: true
      };
    } else {
      // freetier
      return {
        cover_letter: true,
        resume: true,
        questionAndAnswers: true,
        upload: false,
        jobs: false
      };
    }
  }

  // User CRUD operations
  async createUser(userData: Omit<User, '_id' | 'id' | 'createdAt' | 'lastLogin'>): Promise<User> {
    const db = await connectToDatabase();

    const user: Omit<User, '_id' | 'id'> = {
      ...userData,
      createdAt: new Date(),
      lastLogin: new Date()
    };

    const result = await db.collection('users').insertOne(user);

    return {
      ...user,
      _id: result.insertedId,
      id: result.insertedId.toString()
    };
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const db = await connectToDatabase();
    const user = await db.collection('users').findOne({ email });

    if (!user) return null;

    return {
      ...user,
      id: user._id.toString()
    } as User;
  }

  async findUserById(id: string): Promise<User | null> {
    const db = await connectToDatabase();
    const user = await db.collection('users').findOne({ _id: new ObjectId(id) });

    if (!user) return null;

    return {
      ...user,
      id: user._id.toString()
    } as User;
  }

  async getAllUsers(): Promise<User[]> {
    const db = await connectToDatabase();
    const users = await db.collection('users').find({}).toArray();

    return users.map(user => ({
      ...user,
      id: user._id.toString()
    })) as User[];
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const db = await connectToDatabase();

    // Remove _id and id from updates
    const { _id, id: userId, ...updateData } = updates as any;

    const result = await db.collection('users').findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) return null;

    return {
      ...result,
      id: result._id.toString()
    } as User;
  }

  async deleteUser(id: string): Promise<boolean> {
    const db = await connectToDatabase();
    const result = await db.collection('users').deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }

  // Session management
  async createSession(userId: string, expiresInMs: number = 7 * 24 * 60 * 60 * 1000): Promise<Session> {
    const db = await connectToDatabase();

    const token = randomBytes(32).toString('hex');
    const session: Omit<Session, '_id' | 'id'> = {
      userId,
      token,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + expiresInMs)
    };

    const result = await db.collection('sessions').insertOne(session);

    return {
      ...session,
      _id: result.insertedId,
      id: result.insertedId.toString()
    };
  }

  async findSessionByToken(token: string): Promise<Session | null> {
    const db = await connectToDatabase();
    const session = await db.collection('sessions').findOne({
      token,
      expiresAt: { $gt: new Date() }
    });

    if (!session) return null;

    return {
      ...session,
      id: session._id.toString()
    } as Session;
  }

  async deleteSession(token: string): Promise<boolean> {
    const db = await connectToDatabase();
    const result = await db.collection('sessions').deleteOne({ token });
    return result.deletedCount > 0;
  }

  async deleteUserSessions(userId: string): Promise<number> {
    const db = await connectToDatabase();
    const result = await db.collection('sessions').deleteMany({ userId });
    return result.deletedCount;
  }

  // Usage tracking
  async trackUsage(record: Omit<UsageRecord, '_id' | 'id' | 'timestamp'>): Promise<UsageRecord> {
    const db = await connectToDatabase();

    const usageRecord: Omit<UsageRecord, '_id' | 'id'> = {
      ...record,
      timestamp: new Date()
    };

    const result = await db.collection('usage').insertOne(usageRecord);

    return {
      ...usageRecord,
      _id: result.insertedId,
      id: result.insertedId.toString()
    };
  }

  async getUserUsage(userId: string, limit: number = 100): Promise<UsageRecord[]> {
    const db = await connectToDatabase();
    const usage = await db.collection('usage')
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    return usage.map(record => ({
      ...record,
      id: record._id.toString()
    })) as UsageRecord[];
  }

  async getAllUsage(limit: number = 100): Promise<UsageRecord[]> {
    const db = await connectToDatabase();
    const usage = await db.collection('usage')
      .find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    return usage.map(record => ({
      ...record,
      id: record._id.toString()
    })) as UsageRecord[];
  }
}

// Export singleton instance
export const userService = new UserService();
