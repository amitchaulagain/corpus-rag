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

    // ========================================
    // COLLECTION 6: TOKEN PLANS
    // ========================================
    await db.collection('token_plans').createIndex({ planId: 1 }, { unique: true });
    await db.collection('token_plans').createIndex({ isActive: 1, displayOrder: 1 });
    // console.log('  ✅ token_plans - Subscription plan configurations');

    // ========================================
    // COLLECTION 7: ORDERS
    // ========================================
    await db.collection('orders').createIndex({ userId: 1, createdAt: -1 });
    await db.collection('orders').createIndex({ orderNumber: 1 }, { unique: true });
    await db.collection('orders').createIndex({ status: 1 });
    await db.collection('orders').createIndex({ stripePaymentIntentId: 1 }, { sparse: true });
    await db.collection('orders').createIndex({ stripeSessionId: 1 }, { sparse: true });
    await db.collection('orders').createIndex({ stripeCustomerId: 1 });
    await db.collection('orders').createIndex({ createdAt: -1 });
    // console.log('  ✅ orders - Token purchase orders');

    // ========================================
    // COLLECTION 8: TOKEN TRANSACTIONS
    // ========================================
    await db.collection('token_transactions').createIndex({ userId: 1, createdAt: -1 });
    await db.collection('token_transactions').createIndex({ type: 1 });
    await db.collection('token_transactions').createIndex({ orderId: 1 }, { sparse: true });
    await db.collection('token_transactions').createIndex({ jobId: 1 }, { sparse: true });
    // console.log('  ✅ token_transactions - Token movement audit trail');

    // ========================================
    // COLLECTION 9: STRIPE WEBHOOKS
    // ========================================
    await db.collection('stripe_webhooks').createIndex({ stripeEventId: 1 }, { unique: true });
    await db.collection('stripe_webhooks').createIndex({ processed: 1, createdAt: -1 });
    await db.collection('stripe_webhooks').createIndex({ eventType: 1 });
    // console.log('  ✅ stripe_webhooks - Stripe webhook event tracking');

    // ========================================
    // USERS COLLECTION - Additional Token Indexes
    // ========================================
    await db.collection('users').createIndex({ tokenBalance: 1 });
    await db.collection('users').createIndex({ stripeCustomerId: 1 }, { unique: true, sparse: true });
    await db.collection('users').createIndex({ currentPlan: 1 });
    // console.log('  ✅ users - Additional token-related indexes');

    // ========================================
    // USERS COLLECTION - RBAC Indexes
    // ========================================
    await db.collection('users').createIndex({ 'roles.role': 1 });
    await db.collection('users').createIndex({ 'roles.departmentId': 1 });
    await db.collection('users').createIndex({ 'roles.isActive': 1 });
    await db.collection('users').createIndex({ departments: 1 });
    await db.collection('users').createIndex({ primaryDepartmentId: 1 });
    await db.collection('users').createIndex({ 'agentProfile.agentId': 1 });
    await db.collection('users').createIndex({ 'agentProfile.isActive': 1 });
    // console.log('  ✅ users - RBAC indexes');

    // ========================================
    // COLLECTION 10: ROLES
    // ========================================
    await db.collection('roles').createIndex({ name: 1 }, { unique: true });
    await db.collection('roles').createIndex({ isSystemRole: 1 });
    await db.collection('roles').createIndex({ departmentSpecific: 1 });
    // console.log('  ✅ roles - Role definitions');

    // ========================================
    // COLLECTION 11: DEPARTMENTS
    // ========================================
    await db.collection('departments').createIndex({ code: 1 }, { unique: true });
    await db.collection('departments').createIndex({ name: 1 });
    await db.collection('departments').createIndex({ isActive: 1 });
    await db.collection('departments').createIndex({ parentDepartmentId: 1 });
    // console.log('  ✅ departments - Department definitions');

    // ========================================
    // COLLECTION 12: AGENTS
    // ========================================
    await db.collection('agents').createIndex({ userId: 1 }, { unique: true });
    await db.collection('agents').createIndex({ agencyName: 1 });
    await db.collection('agents').createIndex({ isActive: 1 });
    await db.collection('agents').createIndex({ licenseNumber: 1 }, { sparse: true });
    // console.log('  ✅ agents - Agent/agency profiles');

    // ========================================
    // COLLECTION 13: AGENT_JOB_SEEKER_RELATIONSHIPS
    // ========================================
    await db.collection('agent_job_seeker_relationships').createIndex({ agentId: 1, jobSeekerId: 1 }, { unique: true });
    await db.collection('agent_job_seeker_relationships').createIndex({ agentId: 1, status: 1 });
    await db.collection('agent_job_seeker_relationships').createIndex({ jobSeekerId: 1, status: 1 });
    await db.collection('agent_job_seeker_relationships').createIndex({ status: 1 });
    // console.log('  ✅ agent_job_seeker_relationships - Agent-job seeker links');

    // ========================================
    // COLLECTION 14: AGENT_APPLICATIONS
    // ========================================
    await db.collection('agent_applications').createIndex({ agentId: 1, createdAt: -1 });
    await db.collection('agent_applications').createIndex({ jobSeekerId: 1, createdAt: -1 });
    await db.collection('agent_applications').createIndex({ jobId: 1 });
    await db.collection('agent_applications').createIndex({ status: 1 });
    await db.collection('agent_applications').createIndex({ 'charges.status': 1 });
    await db.collection('agent_applications').createIndex({ submittedAt: -1 });
    // console.log('  ✅ agent_applications - Agent-submitted applications');

    // ========================================
    // COLLECTION 15: AUDIT_LOGS
    // ========================================
    await db.collection('audit_logs').createIndex({ userId: 1, timestamp: -1 });
    await db.collection('audit_logs').createIndex({ action: 1, timestamp: -1 });
    await db.collection('audit_logs').createIndex({ resourceType: 1, resourceId: 1, timestamp: -1 });
    await db.collection('audit_logs').createIndex({ timestamp: -1 });
    await db.collection('audit_logs').createIndex({ 'details.metadata': 1 });
    // console.log('  ✅ audit_logs - System audit trail');

    // ========================================
    // COLLECTION 16: GENERIC_QUESTIONS
    // ========================================
    await db.collection('generic_questions').createIndex({ userId: 1, isActive: 1 });
    await db.collection('generic_questions').createIndex({ userId: 1, questionId: 1 });
    await db.collection('generic_questions').createIndex({ userId: 1, createdAt: -1 });
    // console.log('  ✅ generic_questions - User-specific generic Q&A');

    // ========================================
    // COLLECTION 17: GENERIC_QUESTIONS_SETTINGS
    // ========================================
    await db.collection('generic_questions_settings').createIndex({ userId: 1 }, { unique: true });
    // console.log('  ✅ generic_questions_settings - User Q&A preferences');

    // ========================================
    // COLLECTION 18: DOCUMENTS (RAG)
    // ========================================
    await db.collection('documents').createIndex({ userId: 1, profileId: 1 });
    await db.collection('documents').createIndex({ userId: 1, fileHash: 1 }, { unique: true, sparse: true });
    await db.collection('documents').createIndex({ userId: 1, docType: 1, updatedAt: -1 });
    await db.collection('documents').createIndex({ userId: 1, source: 1 });
    await db.collection('documents').createIndex({ jobId: 1 }, { sparse: true });

    // ========================================
    // COLLECTION 19: DOCUMENT_CHUNKS (RAG)
    // ========================================
    await db.collection('document_chunks').createIndex({ userId: 1, profileId: 1, documentId: 1 });
    await db.collection('document_chunks').createIndex({ userId: 1, docType: 1, updatedAt: -1 });
    await db.collection('document_chunks').createIndex({ userId: 1, jobId: 1, updatedAt: -1 }, { sparse: true });
    await db.collection('document_chunks').createIndex({ userId: 1, chunkHash: 1 }, { unique: true });
    await db.collection('document_chunks').createIndex({ userId: 1, keywords: 1 });

    // ========================================
    // COLLECTION 20: QA_CACHE (RAG)
    // ========================================
    await db.collection('qa_cache').createIndex(
      { userId: 1, profileId: 1, jobId: 1, questionHash: 1, promptVersion: 1, profileVersion: 1 },
      { unique: true }
    );
    await db.collection('qa_cache').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });
    await db.collection('qa_cache').createIndex({ userId: 1, updatedAt: -1 });

    // console.log('\n🎉 Optimized schema created with 16 collections:');
    // console.log('   • users (with embedded platforms + token management + RBAC)');
    // console.log('   • sessions (OAuth tokens with TTL auto-expiry)');
    // console.log('   • jobs (with embedded applications)');
    // console.log('   • usage (API usage analytics)');
    // console.log('   • api_keys (external API authentication)');
    // console.log('   • token_plans (subscription plans)');
    // console.log('   • orders (token purchases)');
    // console.log('   • token_transactions (token audit trail)');
    // console.log('   • stripe_webhooks (payment events)');
    // console.log('   • roles (RBAC role definitions)');
    // console.log('   • departments (department definitions)');
    // console.log('   • agents (agent/agency profiles)');
    // console.log('   • agent_job_seeker_relationships (agent-job seeker links)');
    // console.log('   • agent_applications (agent-submitted applications)');
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
