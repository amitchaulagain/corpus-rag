# Inquisitive Mind - Optimized Database Schema

## 🎯 Overview

**Database Name:** `inquisitive_mind`  
**MongoDB Version:** 8.0.15  
**Total Collections:** 4 (optimized from 6)  
**Total Indexes:** 29  

## 📊 MongoDB Best Practices Applied

✅ **33% Collection Reduction** - Reduced from 6 to 4 collections  
✅ **Embedded Documents** - Used for 1-to-1 and 1-to-few relationships  
✅ **TTL Indexing** - Automatic session cleanup  
✅ **Compound Indexes** - Optimized for common query patterns  
✅ **Unique Constraints** - Data integrity enforcement  
✅ **Sparse Indexes** - Efficient indexing of optional fields  

---

## 📁 Collection Structure

### 1. 👥 USERS Collection

**Purpose:** User management with embedded platform settings

**Structure:**
```javascript
{
  _id: ObjectId,
  email: "user@example.com",              // UNIQUE
  googleId: "107411674893...",            // UNIQUE, SPARSE
  name: "John Doe",
  picture: "https://...",
  
  userType: "admin" | "premium" | "freetier",
  isPaid: boolean,
  
  apiPermissions: {
    cover_letter: boolean,
    resume: boolean,
    questionAndAnswers: boolean,
    upload: boolean,
    jobs: boolean
  },
  
  // EMBEDDED: 1-to-few relationship
  platforms: [
    {
      platform: "seek" | "linkedin" | "indeed" | "other",
      credentials: { /* encrypted */ },
      isActive: boolean,
      lastSync: Date,
      metadata: {}
    }
  ],
  
  // EMBEDDED: User preferences
  preferences: {
    notifications: boolean,
    autoApply: boolean,
    preferredAIProvider: string
  },
  
  createdAt: Date,
  lastLogin: Date,
  updatedAt: Date
}
```

**Indexes (7):**
1. `_id` (default)
2. `email` 🔒 UNIQUE
3. `googleId` 🔒 UNIQUE 📊 SPARSE
4. `userType`
5. `platforms.platform` (for querying by platform)
6. `platforms.isActive` (for active platforms)
7. `lastLogin` (descending)

**Benefits:**
- Platforms embedded (no separate `user_platforms` collection)
- Single query to get user with all platform settings
- Efficient for 1-to-few relationship (users typically have 1-3 platforms)

---

### 2. 🔑 SESSIONS Collection

**Purpose:** Authentication sessions with automatic expiration

**Structure:**
```javascript
{
  _id: ObjectId,
  userId: "68e843c2c216...",              // Reference to users._id
  token: "a1b2c3d4e5f6...",               // UNIQUE
  createdAt: Date,
  expiresAt: Date                         // TTL auto-delete
}
```

**Indexes (4):**
1. `_id` (default)
2. `token` 🔒 UNIQUE
3. `userId`
4. `expiresAt` ⏰ TTL (auto-expire)

**Benefits:**
- Automatic cleanup of expired sessions
- No manual cleanup required
- TTL index deletes documents after expiration

**Why Separate?**
- TTL indexing requires separate collection
- High write/delete volume (good to isolate)

---

### 3. 💼 JOBS Collection

**Purpose:** Job postings with embedded application data

**Structure:**
```javascript
{
  _id: ObjectId,
  userId: "68e843c2c216...",
  platform: "seek" | "linkedin" | "indeed",
  platformJobId: "seek_12345",            // External job ID
  
  // Job details
  title: "Senior Software Engineer",
  company: "Acme Corporation",
  location: "Sydney, NSW",
  salary: "$120,000 - $150,000",
  description: "Full job description...",
  url: "https://seek.com.au/job/12345",
  
  // Job metadata
  postedDate: Date,
  closingDate: Date,
  jobType: "full-time" | "part-time" | "contract" | "casual",
  workMode: "remote" | "hybrid" | "onsite",
  status: "pending" | "applied" | "rejected" | "interview" | "offer",
  
  // EMBEDDED: 1-to-1 relationship
  application: {
    status: "pending" | "applied" | ...,
    appliedAt: Date,
    
    // Generated content
    coverLetter: "Dear Hiring Manager...",
    tailoredResume: "John Doe\nSenior...",
    questionAnswers: [
      {
        question: "How many years of experience?",
        answer: "5-10 years - I have 7 years..."
      }
    ],
    
    // EMBEDDED: Complete API call history
    apiCalls: [
      {
        timestamp: Date,
        endpoint: "/api/cover_letter",
        aiProvider: "deepseek",
        request: { /* prompt, jobDetails, resumeText */ },
        response: { /* success, data */ },
        tokensUsed: 1250,
        cost: 0.0025,
        processingTime: 3500  // milliseconds
      }
    ],
    
    // EMBEDDED: Automation bot logs
    automationLogs: [
      {
        timestamp: Date,
        action: "Job discovered on Seek",
        success: true,
        message: "Found matching job"
      }
    ],
    
    createdAt: Date,
    updatedAt: Date
  },
  
  firstSeenAt: Date,
  lastUpdatedAt: Date,
  
  // Raw data for reference
  rawData: {
    original_json: {},
    html_content: ""
  }
}
```

**Indexes (11):**
1. `_id` (default)
2. `userId`
3. `platform`
4. `userId, platform` (compound)
5. `userId, platform, platformJobId` 🔒 UNIQUE (compound)
6. `status`
7. `application.status` (embedded field)
8. `lastUpdatedAt` (descending)
9. `postedDate` (descending)
10. `company`
11. `userId, status, lastUpdatedAt` (compound, descending)

**Benefits:**
- Application data embedded (no separate `job_applications` collection)
- Single query to get job with full application history
- All API calls and logs kept with the job
- Efficient for 1-to-1 relationship (one application per job)

**Why Embedded?**
- Jobs and applications are always accessed together
- 1-to-1 relationship (one application per job)
- Atomic updates (update job and application together)

---

### 4. 📈 USAGE Collection

**Purpose:** API usage tracking and analytics

**Structure:**
```javascript
{
  _id: ObjectId,
  userId: "68e843c2c216...",
  endpoint: "/api/cover_letter",
  aiProvider: "deepseek" | "claude" | "gemini",
  
  tokensUsed: 1250,
  cost: 0.0025,                           // USD
  success: boolean,
  
  timestamp: Date,
  
  // FLEXIBLE: Additional context
  metadata: {
    jobId: ObjectId,
    platform: "seek",
    // ... any other context
  }
}
```

**Indexes (7):**
1. `_id` (default)
2. `userId`
3. `timestamp` (descending)
4. `endpoint`
5. `aiProvider`
6. `userId, timestamp` (compound, descending)
7. `userId, aiProvider` (compound)

**Benefits:**
- Efficient for analytics queries
- Separate for reporting without affecting main collections
- Can be archived/cleaned up independently

**Why Separate?**
- High write volume
- Analytics/reporting focused
- Can be archived independently
- Doesn't clutter job documents

---

## 📊 Schema Optimization Summary

### Before (Old Schema)
```
6 Collections:
├── users
├── sessions
├── usage
├── user_platforms      ❌ Removed
├── jobs
└── job_applications    ❌ Removed
```

### After (Optimized Schema)
```
4 Collections:
├── users (with embedded platforms)
├── sessions
├── jobs (with embedded applications)
└── usage
```

### Benefits

| Aspect | Before | After | Improvement |
|--------|--------|-------|-------------|
| Collections | 6 | 4 | 33% reduction |
| Queries for job+app | 2 | 1 | 50% faster |
| Queries for user+platforms | 2 | 1 | 50% faster |
| Data consistency | Complex | Simple | Atomic updates |
| Disk I/O | Higher | Lower | Fewer seeks |

---

## 🔍 Common Queries

### Get User with Platforms
```javascript
// Single query!
db.users.findOne({ email: "user@example.com" })
// Returns user with embedded platforms array
```

### Get Job with Full Application History
```javascript
// Single query!
db.jobs.findOne({ _id: ObjectId("...") })
// Returns job with embedded application, API calls, and logs
```

### Get User's Active Jobs
```javascript
db.jobs.find({
  userId: "68e843c2c216...",
  status: { $in: ["pending", "applied"] }
}).sort({ lastUpdatedAt: -1 })
```

### Get API Usage Statistics
```javascript
db.usage.aggregate([
  { $match: { userId: "68e843c2c216..." } },
  { $group: {
    _id: "$aiProvider",
    totalCost: { $sum: "$cost" },
    totalTokens: { $sum: "$tokensUsed" },
    count: { $sum: 1 }
  }}
])
```

### Get Jobs by Platform
```javascript
db.jobs.find({
  userId: "68e843c2c216...",
  platform: "seek"
}).sort({ postedDate: -1 })
```

---

## 🚀 Application Features Supported

✅ User authentication (Google OAuth)  
✅ Multi-platform job tracking (Seek, LinkedIn, Indeed)  
✅ Cover letter generation  
✅ Resume tailoring  
✅ Question & Answer generation  
✅ API usage tracking & billing  
✅ Automation bot logging  
✅ Complete audit trail  

---

## 🔒 Data Integrity

### Unique Constraints
- `users.email` - One email per user
- `users.googleId` - One Google account per user
- `sessions.token` - Unique session tokens
- `jobs.{userId, platform, platformJobId}` - No duplicate jobs per user

### Referential Integrity
- `sessions.userId` → `users._id`
- `jobs.userId` → `users._id`
- `usage.userId` → `users._id`

### Automatic Cleanup
- Sessions auto-delete after expiration (TTL index)
- No orphaned sessions
- No manual cleanup required

---

## 📈 Performance Optimizations

### Index Strategies
1. **Single-field indexes** for simple queries
2. **Compound indexes** for common multi-field queries
3. **Descending indexes** for time-based sorting
4. **Sparse indexes** for optional fields (googleId)
5. **Unique indexes** for data integrity
6. **TTL indexes** for automatic cleanup

### Query Optimization
- Compound index on `{userId, status, lastUpdatedAt}` for dashboard
- Compound index on `{userId, timestamp}` for usage history
- Embedded documents reduce join operations to zero

---

## 🛠️ Maintenance

### Backup
```bash
mongodump --db inquisitive_mind --out /backup/mongodb/$(date +%Y%m%d)
```

### Restore
```bash
mongorestore --db inquisitive_mind /backup/mongodb/20251010/inquisitive_mind
```

### Check Database Size
```bash
mongosh inquisitive_mind --eval "db.stats(1024*1024)" --quiet
```

### Monitor Index Usage
```javascript
db.jobs.aggregate([{ $indexStats: {} }])
```

---

## 📚 Resources

- [MongoDB Data Modeling](https://www.mongodb.com/docs/manual/core/data-modeling-introduction/)
- [Embedded Documents](https://www.mongodb.com/docs/manual/core/data-model-design/#embedded-data-models)
- [TTL Indexes](https://www.mongodb.com/docs/manual/core/index-ttl/)
- [Compound Indexes](https://www.mongodb.com/docs/manual/core/index-compound/)

---

**Created:** October 10, 2025  
**Database:** inquisitive_mind  
**MongoDB Version:** 8.0.15  
**Schema Version:** 1.0 (Optimized)

