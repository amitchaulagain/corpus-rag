// MongoDB connection and utilities
import { MongoClient, Db, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'inquisitive_mind';

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

    // console.log('✅ Connected to MongoDB:', MONGODB_DB_NAME);

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
    // console.log('📊 Creating optimized collections for inquisitive_mind database...');
    // console.log('   Following MongoDB best practices: embedded documents for 1-to-1 relationships');

    // ========================================
    // COLLECTION 1: USERS
    // ========================================
    // Purpose: User management, authentication, and platform settings
    // Structure: {
    //   _id, email, name, password,
    //   userType: "admin" | "premium" | "freetier",
    //   isPaid: boolean,
    //   apiPermissions: { cover_letter, resume, questionAndAnswers, upload, jobs },
    //   platforms: [{                           // EMBEDDED: 1-to-few relationship
    //     platform: "seek" | "linkedin" | "indeed",
    //     credentials: { encrypted_data },
    //     isActive: boolean,
    //     lastSync: Date,
    //     metadata: {}
    //   }],
    //   preferences: {                          // EMBEDDED: User preferences
    //     notifications: boolean,
    //     autoApply: boolean,
    //     preferredAIProvider: string
    //   },
    //   createdAt, lastLogin, updatedAt
    // }

    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ userType: 1 });
    await db.collection('users').createIndex({ 'platforms.platform': 1 });
    await db.collection('users').createIndex({ 'platforms.isActive': 1 });
    await db.collection('users').createIndex({ lastLogin: -1 });
    // console.log('  ✅ users - User accounts with embedded platform settings');

    // ========================================
    // COLLECTION 2: SESSIONS
    // ========================================
    // Purpose: Authentication sessions with automatic expiration
    // Structure: { _id, userId, token, createdAt, expiresAt }
    // Note: Kept separate for TTL indexing (auto-cleanup of expired sessions)
    
    await db.collection('sessions').createIndex({ token: 1 }, { unique: true });
    await db.collection('sessions').createIndex({ userId: 1 });
    await db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    // console.log('  ✅ sessions - Auth sessions with TTL auto-expiry');

    // ========================================
    // COLLECTION 3: JOBS
    // ========================================
    // Purpose: Job postings with embedded application data
    // Structure: {
    //   _id, userId, platform: "seek" | "linkedin" | "indeed",
    //   platformJobId, title, company, location, salary, description, url,
    //   postedDate, closingDate, jobType, workMode,
    //   status: "pending" | "applied" | "rejected" | "interview" | "offer",
    //   
    //   application: {                         // EMBEDDED: 1-to-1 relationship
    //     status, appliedAt,
    //     coverLetter, tailoredResume,
    //     questionAnswers: [{ question, answer }],
    //     apiCalls: [{                         // EMBEDDED: API call history
    //       timestamp, endpoint, aiProvider,
    //       request: {}, response: {},
    //       tokensUsed, cost, processingTime
    //     }],
    //     automationLogs: [{                   // EMBEDDED: Bot activity logs
    //       timestamp, action, success, message
    //     }],
    //     createdAt, updatedAt
    //   },
    //   
    //   firstSeenAt, lastUpdatedAt,
    //   rawData: { original_json, html_content }
    // }
    
    await db.collection('jobs').createIndex({ userId: 1 });
    await db.collection('jobs').createIndex({ platform: 1 });
    await db.collection('jobs').createIndex({ userId: 1, platform: 1 });
    await db.collection('jobs').createIndex({ userId: 1, platform: 1, platformJobId: 1 }, { unique: true });
    await db.collection('jobs').createIndex({ status: 1 });
    await db.collection('jobs').createIndex({ 'application.status': 1 });
    await db.collection('jobs').createIndex({ lastUpdatedAt: -1 });
    await db.collection('jobs').createIndex({ postedDate: -1 });
    await db.collection('jobs').createIndex({ company: 1 });
    await db.collection('jobs').createIndex({ userId: 1, status: 1, lastUpdatedAt: -1 });
    // console.log('  ✅ jobs - Job postings with embedded application data');

    // ========================================
    // COLLECTION 4: USAGE
    // ========================================
    // Purpose: API usage tracking and analytics
    // Structure: {
    //   _id, userId, endpoint, aiProvider,
    //   tokensUsed, cost, success,
    //   timestamp,
    //   metadata: { jobId, platform, ... }    // FLEXIBLE: Additional context
    // }
    // Note: Kept separate for analytics, reporting, and efficient querying
    
    await db.collection('usage').createIndex({ userId: 1 });
    await db.collection('usage').createIndex({ timestamp: -1 });
    await db.collection('usage').createIndex({ endpoint: 1 });
    await db.collection('usage').createIndex({ aiProvider: 1 });
    await db.collection('usage').createIndex({ userId: 1, timestamp: -1 });
    await db.collection('usage').createIndex({ userId: 1, aiProvider: 1 });
    // console.log('  ✅ usage - API usage analytics');

    // ========================================
    // COLLECTION 5: API_KEYS
    // ========================================
    // Purpose: API keys for external applications (persistent, secure)
    // Structure: {
    //   _id, userId, keyHash (SHA256), keyPrefix (for display),
    //   name, scopes: ['admin', 'cover_letter', 'resume', ...],
    //   isActive, createdAt, lastUsed, expiresAt
    // }
    // Note: Keys are hashed for security, never stored in plain text

    await db.collection('api_keys').createIndex({ keyHash: 1 }, { unique: true });
    await db.collection('api_keys').createIndex({ userId: 1 });
    await db.collection('api_keys').createIndex({ isActive: 1 });
    await db.collection('api_keys').createIndex({ expiresAt: 1 }, { sparse: true });
    await db.collection('api_keys').createIndex({ userId: 1, isActive: 1 });
    // console.log('  ✅ api_keys - External API authentication (hashed keys)');

    // console.log('\n🎉 Optimized schema created with 5 collections:');
    // console.log('   • users (with embedded platforms)');
    // console.log('   • sessions (OAuth tokens with TTL auto-expiry)');
    // console.log('   • jobs (with embedded applications)');
    // console.log('   • usage (API usage analytics)');
    // console.log('   • api_keys (external API authentication)');
    // console.log('\n✅ All indexes created successfully!');
  } catch (error: any) {
    // Ignore index already exists errors
    if (error.code !== 85 && error.code !== 86) {
      console.error('❌ Error creating indexes:', error);
      throw error;
    }
    // console.log('✅ MongoDB indexes verified (already exist)');
  }
}

export async function closeDatabase() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    // console.log('🔌 MongoDB connection closed');
  }
}

// Alias for backward compatibility
export const getDB = connectToDatabase;
export const connectDB = connectToDatabase;
export const closeDB = closeDatabase;

export { ObjectId };
export type { Db };
