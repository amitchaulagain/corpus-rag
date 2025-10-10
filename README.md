# Corpus RAG - Job Application Automation API

A comprehensive API service for automating job applications across multiple platforms (Seek, LinkedIn, Indeed) with AI-powered content generation and complete tracking.

## 🎯 Overview

This system provides APIs for automation bots to:
- Generate tailored cover letters
- Create customized resumes
- Answer employer screening questions
- Track all applications with complete audit trails
- Monitor usage, costs, and API performance

## 🚀 Quick Start

### 1. Authentication

All API requests require a session token obtained via Google OAuth.

```javascript
// Login and get session token
const response = await fetch('http://your-server:3000/api/auth/login-json', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    credential: '<GOOGLE_ID_TOKEN>' // From Google OAuth
  })
});

const { success, token, user } = await response.json();
// Store this token for all subsequent API calls
```

### 2. Check API Permissions

Users have granular permissions per endpoint:

```javascript
{
  "apiPermissions": {
    "cover_letter": true,
    "resume": true,
    "questionAndAnswers": true,
    "upload": true,
    "jobs": true
  }
}
```

## 📡 API Endpoints

### Authentication Header

All requests must include:
```javascript
headers: {
  'Authorization': 'Bearer <SESSION_TOKEN>',
  'Content-Type': 'application/json'
}
```

---

## 1. Cover Letter Generation

**Endpoint:** `POST /api/cover_letter`

Generates a tailored cover letter using AI based on job description and user's resume.

### Request Body

```javascript
{
  // Required fields
  "job_id": "unique_job_identifier",
  "job_details": "Full job description text or JSON object",
  "resume_text": "User's resume content",
  "useAi": "deepseek", // or "claude", "gemini"

  // Optional tracking fields
  "platform": "seek", // "seek", "linkedin", "indeed", "other"
  "platform_job_id": "seek_12345", // External job ID from platform
  "job_title": "Senior Software Engineer",
  "company": "Acme Corporation",

  // Optional custom prompt
  "prompt": "Write a professional cover letter highlighting my backend experience..."
}
```

### Response

```javascript
{
  "cover_letter": "Generated cover letter text...",
  "job_id": "unique_job_identifier"
}
```

### What Gets Tracked

- Job record created/updated in MongoDB
- Application record with cover letter
- Complete API call log:
  - Request prompt and job details
  - Response content
  - AI tokens used and cost
  - Processing time

---

## 2. Resume Generation

**Endpoint:** `POST /api/resume`

Creates a tailored resume optimized for the specific job posting.

### Request Body

```javascript
{
  // Required fields
  "job_id": "unique_job_identifier",
  "job_details": "Full job description text or JSON object",
  "resume_text": "User's base resume content",
  "useAi": "claude", // or "deepseek", "gemini"

  // Optional tracking fields
  "platform": "linkedin",
  "platform_job_id": "linkedin_67890",
  "job_title": "Full Stack Developer",
  "company": "Tech Startup Inc",

  // Optional custom prompt
  "prompt": "Tailor this resume for a startup environment..."
}
```

### Response

```javascript
{
  "resume": "Generated tailored resume text...",
  "job_id": "unique_job_identifier"
}
```

---

## 3. Question & Answers

**Endpoint:** `POST /api/questionAndAnswers`

Generates answers to employer screening questions using AI.

### Request Body

```javascript
{
  // Required fields
  "job_id": "unique_job_identifier",
  "questions": [
    {
      "q": "How many years of experience do you have?",
      "opts": ["0-2 years", "3-5 years", "5-10 years", "10+ years"]
    },
    {
      "question": "Are you authorized to work in this country?",
      "options": ["Yes", "No", "Require sponsorship"]
    }
  ],
  "resume_text": "User's resume content",
  "useAi": "gemini",

  // Optional fields
  "job_details": "Full job description for context",
  "platform": "indeed",
  "platform_job_id": "indeed_abc123",
  "job_title": "Data Scientist",
  "company": "Analytics Corp",

  // Optional custom prompt
  "prompt": "Answer these questions professionally and honestly..."
}
```

### Response

```javascript
{
  "answers": "AI-generated answers with rationale...",
  "job_id": "unique_job_identifier",
  "questions_count": 2
}
```

---

## 📊 Data Hierarchy

All API calls are tracked in this structure:

```
User
└── Platforms (seek, linkedin, indeed)
    └── Jobs (platform_job_id: unique per platform)
        └── Applications
            ├── Cover Letter
            ├── Tailored Resume
            ├── Question Answers
            ├── API Calls []
            │   ├── Timestamp
            │   ├── Endpoint
            │   ├── AI Provider
            │   ├── Request (prompt, job details, resume)
            │   ├── Response (generated content)
            │   ├── Tokens Used
            │   ├── Cost
            │   └── Processing Time
            └── Automation Logs []
                ├── Timestamp
                ├── Action
                ├── Success/Failure
                └── Message
```

---

## 🤖 Bot Integration Examples

### Example 1: Seek Bot - Complete Application Flow

```javascript
class SeekBot {
  constructor(sessionToken) {
    this.token = sessionToken;
    this.baseUrl = 'http://your-server:3000/api';
  }

  async applyToJob(seekJob) {
    const jobData = {
      platform: 'seek',
      platform_job_id: seekJob.id,
      job_title: seekJob.title,
      company: seekJob.company,
      job_details: seekJob.description,
      resume_text: await this.getUserResume(),
      useAi: 'deepseek'
    };

    // 1. Generate cover letter
    const coverLetter = await fetch(`${this.baseUrl}/cover_letter`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...jobData,
        job_id: `seek_${seekJob.id}`,
        prompt: 'Write a compelling cover letter for this Seek job posting...'
      })
    }).then(r => r.json());

    // 2. Generate tailored resume
    const resume = await fetch(`${this.baseUrl}/resume`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...jobData,
        job_id: `seek_${seekJob.id}`,
        prompt: 'Optimize this resume for ATS and highlight relevant experience...'
      })
    }).then(r => r.json());

    // 3. Answer screening questions (if any)
    if (seekJob.questions && seekJob.questions.length > 0) {
      const answers = await fetch(`${this.baseUrl}/questionAndAnswers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...jobData,
          job_id: `seek_${seekJob.id}`,
          questions: seekJob.questions
        })
      }).then(r => r.json());

      await this.submitApplication(seekJob, {
        coverLetter: coverLetter.cover_letter,
        resume: resume.resume,
        answers: answers.answers
      });
    }
  }
}
```

### Example 2: LinkedIn Bot - Batch Processing

```javascript
async function processLinkedInJobs(jobs, sessionToken) {
  for (const job of jobs) {
    try {
      // Generate application materials
      const [coverLetter, resume] = await Promise.all([
        generateCoverLetter(job, sessionToken),
        generateResume(job, sessionToken)
      ]);

      // Submit to LinkedIn
      await submitLinkedInApplication(job.id, {
        coverLetter: coverLetter.cover_letter,
        resume: resume.resume
      });

      console.log(`✅ Applied to ${job.title} at ${job.company}`);
    } catch (error) {
      console.error(`❌ Failed for ${job.title}:`, error);
    }

    // Rate limiting
    await sleep(5000);
  }
}

async function generateCoverLetter(job, token) {
  return fetch('http://your-server:3000/api/cover_letter', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      platform: 'linkedin',
      platform_job_id: job.id,
      job_id: `linkedin_${job.id}`,
      job_title: job.title,
      company: job.company,
      job_details: job.description,
      resume_text: USER_RESUME,
      useAi: 'claude' // Use Claude for LinkedIn
    })
  }).then(r => r.json());
}
```

---

## 🎨 Admin UI

Access the admin interface to view all tracked data:

### Dashboard (`/dashboard`)
- User statistics
- API call metrics
- Quick actions

### Users (`/users`)
- Manage users
- Set permissions
- View user types (admin/premium/freetier)

### Job Tracking (`/jobs`)
- View all jobs by platform
- Expandable hierarchy:
  - Platform → Jobs → Applications
  - See all generated content
  - API call history with costs
  - Automation logs

---

## 💾 Database Collections

### `users`
- User authentication and permissions
- User type (admin/premium/freetier)
- API access control

### `user_platforms`
- Platform credentials per user
- Sync status
- Platform-specific settings

### `jobs`
- Job postings from platforms
- Unique: `userId + platform + platformJobId`
- Job status tracking

### `job_applications`
- Generated content per job
- Complete API call history
- Automation logs

### `sessions`
- Active session tokens
- Auto-expires after 7 days

### `usage`
- API usage tracking
- Token consumption
- Cost tracking

---

## 🔒 Security

### Authentication
- Google OAuth 2.0 required
- Session-based tokens
- 7-day expiration

### Authorization
- Admin-only UI access
- Per-user API permissions
- Granular endpoint control

### Pre-authorized Admins
```javascript
// In login-json endpoint
const ADMIN_EMAILS = [
  'puskarwagle17@gmail.com',
  'achaulagain123@gmail.com'
];
```

---

## 💰 Usage Tiers

### Admin
- Full access to all features
- Unlimited API calls
- UI access

### Premium
- Unlimited API calls
- All endpoints enabled
- No UI access

### Free Tier
- Limited tokens/jobs per month
- Rate limited
- Basic endpoints only

---

## 📈 Monitoring & Analytics

Track usage via the Job Tracking UI:
- Total jobs per platform
- Application success rates
- AI provider costs
- Processing times
- Token consumption

---

## 🛠️ Environment Variables

```bash
# MongoDB
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=corpus_rag

# Google OAuth
PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=your-client-secret

# AI Providers
CLAUDE_API_KEY=sk-ant-api03-...
DEEPSEEK_API_KEY=sk-...
GEMINI_API_KEY=AIza...
```

---

## 🚦 Rate Limiting

Free tier users are rate limited. Premium/Admin users have no limits.

---

## 📞 Support

For issues or questions:
- Check the Job Tracking UI for detailed error logs
- Review API call history for failed requests
- Contact admin for access issues

---

## 🎯 Best Practices

1. **Always include tracking fields** (`platform`, `platform_job_id`, etc.) for proper database organization
2. **Use custom prompts** for better AI results tailored to specific platforms
3. **Monitor costs** via the Job Tracking UI
4. **Implement retry logic** for failed API calls
5. **Rate limit your bot** to avoid overwhelming the API
6. **Store session tokens securely** and refresh before expiration

---

## 🔄 Typical Bot Workflow

```
1. Bot discovers job on platform (Seek/LinkedIn/Indeed)
2. Bot calls /api/cover_letter with job details
   └─ System creates Job record in MongoDB
   └─ System creates Application record
   └─ System logs API call
3. Bot calls /api/resume with same job_id
   └─ System updates Application record
   └─ System logs API call
4. Bot calls /api/questionAndAnswers (if questions exist)
   └─ System updates Application record
   └─ System logs API call
5. Bot submits application to platform
6. Admin reviews in Job Tracking UI
   └─ See all generated content
   └─ Review API call costs
   └─ Monitor automation logs
```

---

## 📝 License

MIT

---

## 🙏 Credits

Built with:
- SvelteKit
- MongoDB
- Google OAuth
- OpenAI/Anthropic/DeepSeek APIs
- DaisyUI
