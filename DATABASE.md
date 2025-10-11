# Database Documentation - Corpus RAG

Complete guide to the MongoDB database structure, installation, and usage for the job application automation system.

## 📊 Database Overview

This application uses **MongoDB** to store:
- User accounts and authentication
- Job postings from multiple platforms (Seek, LinkedIn, Indeed)
- Job applications with generated content
- Complete API call history with costs
- Usage tracking and analytics

---

## 🔧 Installation & Setup

### 1. Install MongoDB

#### Ubuntu/Debian
```bash
# Import MongoDB public GPG key
wget -qO - https://www.mongodb.org/static/pgp/server-8.0.asc | sudo apt-key add -

# Create list file for MongoDB
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list

# Update package database
sudo apt-get update

# Install MongoDB
sudo apt-get install -y mongodb-org

# Start MongoDB service
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify installation
mongod --version
```

#### macOS
```bash
# Install with Homebrew
brew tap mongodb/brew
brew install mongodb-community@8.0

# Start MongoDB service
brew services start mongodb-community@8.0

# Verify installation
mongod --version
```

#### Windows
Download from: https://www.mongodb.com/try/download/community

### 2. Verify MongoDB is Running

```bash
# Check service status
sudo systemctl status mongod

# Or check if MongoDB is listening
netstat -tuln | grep 27017

# Connect to MongoDB shell
mongosh
```

### 3. Configure Environment Variables

Add to your `.env` file:

```bash
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=corpus_rag

# Google OAuth (required for authentication)
PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=your-client-secret

# AI Provider API Keys
CLAUDE_API_KEY=sk-ant-api03-...
DEEPSEEK_API_KEY=sk-...
GEMINI_API_KEY=AIza...
```

### 4. Initialize Database

The application automatically creates collections and indexes on first run. Or run manually:

```bash
npm run dev
# Collections and indexes will be created automatically on first API call
```

### 5. Migrate Existing Data (if upgrading from JSON)

If you have existing data in JSON files:

```bash
node scripts/migrate-to-mongodb.js
```

This will migrate:
- `data/users.json` → `users` collection
- `data/sessions.json` → `sessions` collection (expired sessions are skipped)

---

## 📁 Database Structure

### Database Name: `corpus_rag`

### Collections:

1. **users** - User accounts
2. **sessions** - Authentication sessions
3. **usage** - API usage tracking
4. **user_platforms** - Platform configurations per user
5. **jobs** - Job postings
6. **job_applications** - Application materials and history

---

## 🗂️ Collection Schemas

### 1. `users` Collection

Stores user accounts with authentication and permissions.

```javascript
{
  _id: ObjectId("..."),
  email: "user@example.com",           // Unique, indexed
  googleId: "107411674893141862021",   // From Google OAuth, sparse index
  name: "John Doe",
  picture: "https://lh3.googleusercontent.com/...",

  // User type and access
  userType: "admin",                   // "admin" | "premium" | "freetier"
  isPaid: true,                        // Boolean for payment status

  // Granular API permissions
  apiPermissions: {
    cover_letter: true,
    resume: true,
    questionAndAnswers: true,
    upload: true,
    jobs: true
  },

  // Timestamps
  createdAt: ISODate("2025-10-09T21:29:51.965Z"),
  lastLogin: ISODate("2025-10-09T21:29:51.973Z")
}
```

**Indexes:**
- `email` (unique)
- `googleId` (sparse)

---

### 2. `sessions` Collection

Stores active authentication sessions with automatic expiration.

```javascript
{
  _id: ObjectId("..."),
  userId: "68e843c2c216cce162976391", // Reference to users._id
  token: "a1b2c3d4e5f6...",           // Unique session token, indexed
  createdAt: ISODate("2025-10-09T21:30:00.000Z"),
  expiresAt: ISODate("2025-10-16T21:30:00.000Z") // Auto-delete via TTL
}
```

**Indexes:**
- `token` (unique)
- `userId`
- `expiresAt` (TTL index - auto-deletes expired sessions)

**TTL Configuration:**
Sessions automatically expire and are removed from the database after `expiresAt` is reached.

---

### 3. `usage` Collection

Tracks API usage for analytics and billing.

```javascript
{
  _id: ObjectId("..."),
  userId: "68e843c2c216cce162976391",
  endpoint: "/api/cover_letter",
  aiProvider: "deepseek",              // "deepseek" | "claude" | "gemini"
  tokensUsed: 1250,
  cost: 0.0025,                        // In USD
  success: true,
  timestamp: ISODate("2025-10-10T03:45:12.000Z")
}
```

**Indexes:**
- `userId`
- `timestamp` (descending)
- `endpoint`

---

### 4. `user_platforms` Collection

Stores platform-specific settings and credentials for each user.

```javascript
{
  _id: ObjectId("..."),
  userId: "68e843c2c216cce162976391",
  platform: "seek",                    // "seek" | "linkedin" | "indeed" | "other"

  // Optional credentials (encrypted recommended)
  credentials: {
    username: "user@email.com",
    email: "user@email.com",
    accessToken: "encrypted_token",    // Store encrypted!
    refreshToken: "encrypted_token"
  },

  isActive: true,
  lastSync: ISODate("2025-10-10T03:00:00.000Z"),

  // Platform-specific metadata
  metadata: {
    seekProfileId: "12345",
    linkedinPublicId: "john-doe-123",
    customSettings: {}
  },

  createdAt: ISODate("2025-10-09T21:35:00.000Z"),
  updatedAt: ISODate("2025-10-10T03:00:00.000Z")
}
```

**Indexes:**
- `userId`
- `userId + platform` (compound)

---

### 5. `jobs` Collection

Stores job postings discovered by automation bots.

```javascript
{
  _id: ObjectId("..."),
  userId: "68e843c2c216cce162976391",
  platform: "seek",
  platformJobId: "seek_12345",         // External job ID from platform

  // Job details
  title: "Senior Software Engineer",
  company: "Acme Corporation",
  location: "Sydney, NSW",
  salary: "$120,000 - $150,000",
  description: "Full job description text...",
  url: "https://seek.com.au/job/12345",

  // Job metadata
  postedDate: ISODate("2025-10-05T00:00:00.000Z"),
  closingDate: ISODate("2025-10-20T00:00:00.000Z"),
  jobType: "full-time",                // "full-time" | "part-time" | "contract" | "casual"
  workMode: "hybrid",                  // "remote" | "hybrid" | "onsite"

  // Application status
  status: "pending",                   // "pending" | "applied" | "rejected" | "interview" | "offer" | "withdrawn"

  // Timestamps
  firstSeenAt: ISODate("2025-10-09T22:00:00.000Z"),
  lastUpdatedAt: ISODate("2025-10-10T04:30:00.000Z"),

  // Raw data from platform (for reference)
  rawData: {
    original_json: {},
    html_content: ""
  }
}
```

**Indexes:**
- `userId`
- `userId + platform` (compound)
- `userId + platform + platformJobId` (unique compound)
- `status`
- `lastUpdatedAt` (descending)

**Unique Constraint:**
One user cannot have duplicate jobs from the same platform with the same `platformJobId`.

---

### 6. `job_applications` Collection

Stores all generated content and API interactions for each job.

```javascript
{
  _id: ObjectId("..."),
  userId: "68e843c2c216cce162976391",
  jobId: "68e845a1c216cce162976399",  // Reference to jobs._id (unique)
  platform: "seek",

  // Application status
  status: "pending",                   // Mirrors job status
  appliedAt: ISODate("2025-10-10T05:00:00.000Z"),

  // Generated content
  coverLetter: "Dear Hiring Manager...",
  tailoredResume: "John Doe\nSenior Software Engineer...",
  questionAnswers: [
    {
      question: "How many years of experience?",
      answer: "5-10 years - I have 7 years of experience..."
    }
  ],

  // Complete API call history
  apiCalls: [
    {
      timestamp: ISODate("2025-10-10T04:30:00.000Z"),
      endpoint: "/api/cover_letter",
      aiProvider: "deepseek",

      // What was sent to API
      request: {
        prompt: "Write a compelling cover letter...",
        jobDetails: "Senior Software Engineer at Acme...",
        resumeText: "John Doe resume content..."
      },

      // What API returned
      response: {
        success: true,
        data: "Generated cover letter text..."
      },

      // Usage metrics
      tokensUsed: 1250,
      cost: 0.0025,
      processingTime: 3500              // milliseconds
    },
    {
      timestamp: ISODate("2025-10-10T04:32:00.000Z"),
      endpoint: "/api/resume",
      aiProvider: "deepseek",
      request: { /* ... */ },
      response: { /* ... */ },
      tokensUsed: 2100,
      cost: 0.0042,
      processingTime: 4200
    }
  ],

  // Automation bot logs
  automationLogs: [
    {
      timestamp: ISODate("2025-10-10T04:29:00.000Z"),
      action: "Job discovered on Seek",
      success: true,
      message: "Found matching job: Senior Software Engineer"
    },
    {
      timestamp: ISODate("2025-10-10T04:30:30.000Z"),
      action: "Generated cover letter",
      success: true,
      message: "Used DeepSeek API, 1250 tokens"
    },
    {
      timestamp: ISODate("2025-10-10T05:00:00.000Z"),
      action: "Submitted application to Seek",
      success: true,
      message: "Application submitted successfully"
    }
  ],

  createdAt: ISODate("2025-10-10T04:30:00.000Z"),
  updatedAt: ISODate("2025-10-10T05:00:00.000Z")
}
```

**Indexes:**
- `userId`
- `jobId` (unique - one application per job)
- `userId + platform` (compound)
- `status`

---

## 🔍 Common Database Operations

### Query Examples

#### Get all jobs for a user on Seek
```javascript
db.jobs.find({
  userId: "68e843c2c216cce162976391",
  platform: "seek"
}).sort({ lastUpdatedAt: -1 })
```

#### Get all pending applications
```javascript
db.job_applications.find({
  userId: "68e843c2c216cce162976391",
  status: "pending"
})
```

#### Get total API costs for a user
```javascript
db.usage.aggregate([
  { $match: { userId: "68e843c2c216cce162976391" } },
  { $group: {
    _id: "$aiProvider",
    totalCost: { $sum: "$cost" },
    totalTokens: { $sum: "$tokensUsed" }
  }}
])
```

#### Get job with full application details
```javascript
db.jobs.aggregate([
  { $match: {
    userId: "68e843c2c216cce162976391",
    platform: "linkedin"
  }},
  { $lookup: {
    from: "job_applications",
    localField: "_id",
    foreignField: "jobId",
    as: "application"
  }},
  { $unwind: "$application" }
])
```

#### Count applications by platform
```javascript
db.job_applications.aggregate([
  { $match: { userId: "68e843c2c216cce162976391" } },
  { $group: {
    _id: "$platform",
    count: { $sum: 1 }
  }}
])
```

---

## 🛠️ Database Maintenance

### Backup Database

```bash
# Backup entire database
mongodump --db corpus_rag --out /backup/mongodb/$(date +%Y%m%d)

# Backup specific collection
mongodump --db corpus_rag --collection users --out /backup/users
```

### Restore Database

```bash
# Restore entire database
mongorestore --db corpus_rag /backup/mongodb/20251010/corpus_rag

# Restore specific collection
mongorestore --db corpus_rag --collection users /backup/users/corpus_rag/users.bson
```

### Check Database Size

```javascript
// In mongosh
use corpus_rag
db.stats(1024*1024) // Size in MB
```

### Clean Up Old Sessions

Sessions automatically expire via TTL index, but you can manually clean:

```javascript
db.sessions.deleteMany({
  expiresAt: { $lt: new Date() }
})
```

### Clean Up Old Usage Records

```javascript
// Delete usage records older than 90 days
db.usage.deleteMany({
  timestamp: {
    $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  }
})
```

---

## 📈 Monitoring & Analytics

### Check Database Health

```bash
# Connect to MongoDB
mongosh

# Switch to database
use corpus_rag

# Check collection stats
db.jobs.stats()
db.job_applications.stats()

# Check index usage
db.jobs.aggregate([{ $indexStats: {} }])

# Current connections
db.serverStatus().connections
```

### Performance Queries

```javascript
// Find slow queries (enable profiling first)
db.setProfilingLevel(1, { slowms: 100 })
db.system.profile.find({ millis: { $gt: 100 } }).sort({ ts: -1 })

// Check index usage
db.jobs.explain("executionStats").find({ userId: "..." })
```

---

## 🔒 Security Best Practices

### 1. Enable Authentication

```bash
# In /etc/mongod.conf
security:
  authorization: enabled

# Create admin user
mongosh
use admin
db.createUser({
  user: "admin",
  pwd: "strong_password",
  roles: [{ role: "userAdminAnyDatabase", db: "admin" }]
})

# Create app user
use corpus_rag
db.createUser({
  user: "corpus_rag_app",
  pwd: "app_password",
  roles: [{ role: "readWrite", db: "corpus_rag" }]
})

# Update connection string
MONGODB_URI=mongodb://corpus_rag_app:app_password@localhost:27017/corpus_rag
```

### 2. Encrypt Platform Credentials

When storing platform credentials in `user_platforms`, always encrypt:

```javascript
import crypto from 'crypto';

// Encrypt before storing
const algorithm = 'aes-256-cbc';
const key = process.env.ENCRYPTION_KEY; // 32 bytes
const iv = crypto.randomBytes(16);

function encrypt(text) {
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(key, 'hex'), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}
```

### 3. Regular Backups

Set up automated daily backups:

```bash
# Add to crontab
0 2 * * * mongodump --db corpus_rag --out /backup/mongodb/$(date +\%Y\%m\%d)
```

---

## 🚨 Troubleshooting

### MongoDB won't start
```bash
# Check logs
sudo journalctl -u mongod -n 50

# Check if port is in use
sudo lsof -i :27017

# Restart service
sudo systemctl restart mongod
```

### Connection errors
```bash
# Test connection
mongosh mongodb://localhost:27017/corpus_rag

# Check firewall
sudo ufw status
sudo ufw allow 27017
```

### Out of disk space
```bash
# Check database size
du -sh /var/lib/mongodb

# Compact collections
db.jobs.compact()
db.job_applications.compact()
```

### Slow queries
```javascript
// Enable profiling
db.setProfilingLevel(2)

// Check slow queries
db.system.profile.find({ millis: { $gt: 100 } })

// Create missing indexes
db.jobs.createIndex({ userId: 1, platform: 1 })
```

---

## 📚 Additional Resources

- [MongoDB Official Documentation](https://www.mongodb.com/docs/)
- [MongoDB Node.js Driver](https://www.mongodb.com/docs/drivers/node/current/)
- [Mongoose ODM](https://mongoosejs.com/) (if you want to use schemas)
- [MongoDB University](https://university.mongodb.com/) (free courses)

---

## 💡 Tips for Development

1. **Use MongoDB Compass** - GUI for browsing and querying data
   ```bash
   # Download from: https://www.mongodb.com/products/compass
   ```

2. **Enable query logging during development**
   ```javascript
   // In your app startup
   mongoose.set('debug', true);
   ```

3. **Use transactions for multi-document operations**
   ```javascript
   const session = await mongoose.startSession();
   session.startTransaction();
   try {
     await Job.create([jobData], { session });
     await JobApplication.create([appData], { session });
     await session.commitTransaction();
   } catch (error) {
     await session.abortTransaction();
   } finally {
     session.endSession();
   }
   ```

4. **Index optimization**
   - Only create indexes you actually use
   - Monitor index usage with `$indexStats`
   - Remove unused indexes to save space and write performance

---

## 📞 Support

For database-related issues:
1. Check MongoDB logs: `sudo journalctl -u mongod`
2. Verify collections exist: `db.getCollectionNames()`
3. Check indexes: `db.collection.getIndexes()`
4. Test queries in mongosh before using in application

---

## 🎯 Summary

This MongoDB database provides:
- ✅ Complete job application tracking across multiple platforms
- ✅ Detailed API call history with costs and performance metrics
- ✅ User authentication and authorization
- ✅ Automatic session expiration via TTL indexes
- ✅ Optimized indexes for fast queries
- ✅ Scalable schema design for future growth

The database structure supports the complete automation workflow from job discovery to application submission with full audit trails.
