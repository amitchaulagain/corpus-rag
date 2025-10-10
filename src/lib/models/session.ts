// Session Model
import { ObjectId, type Db } from 'mongodb';
import { randomBytes } from 'crypto';

export interface Session {
  _id?: ObjectId;
  userId: ObjectId;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export class SessionModel {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async create(userId: string | ObjectId, expiresInMs: number = 24 * 60 * 60 * 1000): Promise<Session> {
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + expiresInMs);

    const session: Session = {
      userId: userObjectId,
      token,
      expiresAt,
      createdAt: new Date()
    };

    const result = await this.db.collection<Session>('sessions').insertOne(session);
    return { ...session, _id: result.insertedId };
  }

  async findByToken(token: string): Promise<Session | null> {
    return await this.db.collection<Session>('sessions').findOne({
      token,
      expiresAt: { $gt: new Date() } // Only return non-expired sessions
    });
  }

  async deleteByToken(token: string): Promise<boolean> {
    const result = await this.db.collection<Session>('sessions').deleteOne({ token });
    return result.deletedCount > 0;
  }

  async deleteAllForUser(userId: string | ObjectId): Promise<number> {
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const result = await this.db.collection<Session>('sessions').deleteMany({ userId: userObjectId });
    return result.deletedCount;
  }

  async deleteExpired(): Promise<number> {
    const result = await this.db.collection<Session>('sessions').deleteMany({
      expiresAt: { $lt: new Date() }
    });
    return result.deletedCount;
  }

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  async extendSession(token: string, expiresInMs: number = 24 * 60 * 60 * 1000): Promise<boolean> {
    const expiresAt = new Date(Date.now() + expiresInMs);
    const result = await this.db.collection<Session>('sessions').updateOne(
      { token },
      { $set: { expiresAt } }
    );
    return result.modifiedCount > 0;
  }
}
