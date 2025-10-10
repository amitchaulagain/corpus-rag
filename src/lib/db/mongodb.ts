// MongoDB connection and utilities
import { MongoClient, Db, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'corpus_rag';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectToDatabase(): Promise<Db> {
  if (db) {
    return db;
  }

  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(MONGODB_DB_NAME);

    console.log('✅ Connected to MongoDB:', MONGODB_DB_NAME);

    // Create indexes
    await createIndexes(db);

    return db;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    throw error;
  }
}

async function createIndexes(db: Db) {
  try {
    // Users collection indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ googleId: 1 }, { sparse: true });

    // Sessions collection indexes
    await db.collection('sessions').createIndex({ token: 1 }, { unique: true });
    await db.collection('sessions').createIndex({ userId: 1 });
    await db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    // Usage collection indexes
    await db.collection('usage').createIndex({ userId: 1 });
    await db.collection('usage').createIndex({ timestamp: -1 });
    await db.collection('usage').createIndex({ endpoint: 1 });

    // User platforms indexes
    await db.collection('user_platforms').createIndex({ userId: 1 });
    await db.collection('user_platforms').createIndex({ userId: 1, platform: 1 });

    // Jobs collection indexes
    await db.collection('jobs').createIndex({ userId: 1 });
    await db.collection('jobs').createIndex({ userId: 1, platform: 1 });
    await db.collection('jobs').createIndex({ userId: 1, platform: 1, platformJobId: 1 }, { unique: true });
    await db.collection('jobs').createIndex({ status: 1 });
    await db.collection('jobs').createIndex({ lastUpdatedAt: -1 });

    // Job applications indexes
    await db.collection('job_applications').createIndex({ userId: 1 });
    await db.collection('job_applications').createIndex({ jobId: 1 }, { unique: true });
    await db.collection('job_applications').createIndex({ userId: 1, platform: 1 });
    await db.collection('job_applications').createIndex({ status: 1 });

    console.log('✅ MongoDB indexes created');
  } catch (error: any) {
    // Ignore index already exists errors
    if (error.code !== 85 && error.code !== 86) {
      throw error;
    }
    console.log('✅ MongoDB indexes verified (already exist)');
  }
}

export async function closeDatabase() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('🔌 MongoDB connection closed');
  }
}

export { ObjectId };
export type { Db };
