# Job Application Assistant API

AI-powered API for automating job application tasks: cover letters, resume tailoring, and employer question answering.

**Base URL**: `http://localhost:3000`

---

## 📋 Overview

This application has two main components:

### 1. **Admin Dashboard** (This Application)
- Web interface for managing users, permissions, and system settings
- Monitor API usage and user activity
- Upgrade users from free tier to premium
- Access at `http://localhost:3000`

### 2. **User Applications** (Your Client Apps)
- Third-party applications that integrate with this API
- Users sign up through your client apps via the `/api/auth/signup` endpoint
- New users are automatically created as **freetier** with limited permissions
- Admins manually upgrade users to **premium** through the admin dashboard

---

## 🚀 Quick Start

### For Administrators (Web UI Access)
1. Start the server: `npm run dev`
2. Navigate to `http://localhost:3000`
3. Login with your admin credentials
4. Manage users, permissions, and view API documentation

### For User Applications (API Integration)

**⚠️ IMPORTANT: Two Authentication Methods Available**

Your client app can authenticate using **ONE** of these methods:

#### **Method 1: User Authentication** (For apps with individual user accounts)
1. **Signup/Login** → Get session token (30-day expiry)
2. **Convert to JWT** → Get access token (15-min) + refresh token (30-day)
3. **Call API** → Use JWT access token
4. **Refresh** → Use refresh token to get new access token (no re-login needed!)

#### **Method 2: Service Account** (For server-to-server, bots, automation)
1. **Create service account** → Get client_id/client_secret (one-time)
2. **Get JWT** → Exchange credentials for access token (15-min expiry)
3. **Call API** → Use JWT access token
4. **Refresh** → Request new token when expired (every 15 min)

**Resources:**
- **Interactive Testing**: Visit `http://localhost:3000/api-docs` (Swagger UI)
- **Full Details**: See Authentication section below for complete implementation

---

## 🔐 Authentication

### Authentication Quick Reference

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/auth/signup` | POST | Create account → session token | No |
| `/api/auth/login` | POST | Login → session token | No |
| `/api/auth/session-to-jwt` | POST | Convert session token → JWT | Session Token |
| `/api/auth/token` | POST | Service account → JWT | Client Credentials |
| `/api/auth/forgot-password` | POST | Request password reset | No |
| `/api/auth/reset-password` | POST | Reset password with token | No |
| `/api/auth/me` | GET | Get current user info | JWT |
| `/api/auth/logout` | POST | Logout current session | Session Token |

---

## 🔑 Authentication for External Developers

**All API endpoints require JWT access tokens.** Choose one of these authentication methods:

### 🤔 Which Method Should You Use?

| Your Use Case | Recommended Method |
|---------------|-------------------|
| **Mobile app** with user accounts | ✅ Method 1 (User Authentication) |
| **Web app** with user accounts | ✅ Method 1 (User Authentication) |
| **Desktop app** with user accounts | ✅ Method 1 (User Authentication) |
| **Automation for specific user** | ✅ Method 1 (User Authentication) |
| **Background job per user** | ✅ Method 1 (User Authentication) |
| **Bot acting as a user** | ✅ Method 1 (User Authentication) |
| **Server-wide automation** | ✅ Method 2 (Service Account) |
| **Shared bot for all users** | ✅ Method 2 (Service Account) |

**Key Difference:**
- **Method 1**: Each user has their own account → tracks per-user permissions, rate limits, and usage
  - ✅ **Use this when:** Actions are tied to specific users (automation runs "on behalf of" John, Mary, etc.)
  - ✅ **Refresh tokens (30 days)** make it perfect for long-running automation!

- **Method 2**: One service account → shared credentials for your entire service
  - ✅ **Use this when:** Actions are not user-specific (system-wide bot, admin tasks, etc.)

---

### Method 1: User Authentication (Email/Password)

**Best for:** Apps with individual user accounts (mobile apps, web apps, etc.)

**Complete Flow:**

```
1. POST /api/auth/signup          → session_token (30 days)
2. POST /api/auth/session-to-jwt  → accessToken (15 min) + refreshToken (30 days)
3. POST /api/cover_letter         → Success! (use accessToken)
4. POST /api/auth/refresh         → New accessToken (when expired)
```

**Why the extra step?** Session tokens are for the web UI. API endpoints require JWT tokens for security and rate limiting.

**Perfect for automation:** Get the refresh token once, use it for 30 days to automatically refresh access tokens!

---

#### Step 1: Signup (Create Account)

**Endpoint**: `POST /api/auth/signup`

**Request**:
```json
{
  "email": "user@example.com",
  "password": "yourPassword123",
  "name": "John Doe"
}
```

**Response**:
```json
{
  "success": true,
  "token": "64a5f8b3c1d2e3f4a5b6c7d8e9f0a1b2...",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "userType": "freetier"
  }
}
```

**New User Defaults**:
- **User Type**: `freetier` (automatically assigned)
- **Permissions**: Limited access (cover_letter, upload, jobs only)
- **Upgrade**: Admins manually upgrade users to `premium` for full API access

**Password Requirements**: Minimum 8 characters

---

#### Step 2: Login (Returning Users)

**Endpoint**: `POST /api/auth/login`

**Request**:
```json
{
  "email": "user@example.com",
  "password": "yourPassword123"
}
```

**Response**:
```json
{
  "success": true,
  "token": "64a5f8b3c1d2e3f4a5b6c7d8e9f0a1b2...",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "userType": "freetier"
  }
}
```

**⚠️ IMPORTANT:** The `token` you receive is a **session token**, NOT a JWT. Continue to Step 3.

---

#### Step 3: Convert Session Token to JWT ⚡

**Endpoint**: `POST /api/auth/session-to-jwt`

**Headers**:
```
Authorization: Bearer 64a5f8b3c1d2e3f4a5b6c7d8e9f0a1b2...
```

**Response**:
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900,
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "userType": "freetier"
  }
}
```

**Now you have JWT tokens!**
- Use `accessToken` for API calls (expires in 15 min)
- Save `refreshToken` for getting new access tokens (lasts 30 days)

---

#### Step 4: Call API Endpoints

**Example**: Generate Cover Letter

**Endpoint**: `POST /api/cover_letter`

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Request**:
```json
{
  "job_id": "job_001",
  "job_details": "We are seeking a Senior Developer...",
  "resume_text": "John Doe\nSenior Software Engineer...",
  "useAi": "deepseek-chat",
  "company": "TechCorp",
  "job_title": "Senior Developer"
}
```

**Response**:
```json
{
  "cover_letter": "Dear Hiring Manager,\n\nI am writing to...",
  "job_id": "job_001"
}
```

---

#### Step 5: Refresh Access Token (When Expired)

**Access tokens expire after 15 minutes.** Use your refresh token to get a new one:

**Endpoint**: `POST /api/auth/refresh`

**Request**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response**:
```json
{
  "success": true,
  "accessToken": "new_access_token_here",
  "refreshToken": "new_refresh_token_here",
  "expiresIn": 900
}
```

**⚠️ Important:** Refresh tokens are **rotated** for security. Always save the new `refreshToken` from the response!

**Refresh tokens last 30 days** - perfect for automation scripts!

---

#### Example: Smart Token Management

**For manual API calls** (in user-facing apps):
```javascript
let accessToken = "...";
let refreshToken = "...";

async function callAPI(endpoint, data) {
  try {
    return await fetch(endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(data)
    });
  } catch (error) {
    if (error.status === 401) {
      // Access token expired - refresh it
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken })
      });
      const tokens = await response.json();
      accessToken = tokens.accessToken;
      refreshToken = tokens.refreshToken; // Save new refresh token!

      // Retry original request
      return await fetch(endpoint, {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(data)
      });
    }
    throw error;
  }
}
```

**For automation scripts** (background jobs):
```javascript
// Store these securely (env vars, secrets manager, etc.)
let accessToken = "...";
let refreshToken = "...";
let tokenExpiry = Date.now() + (15 * 60 * 1000);

async function refreshIfNeeded() {
  if (Date.now() >= tokenExpiry - 60000) { // Refresh 1 min before expiry
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken })
    });
    const tokens = await response.json();
    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken; // Important!
    tokenExpiry = Date.now() + (tokens.expiresIn * 1000);
  }
}

// Before each API call
await refreshIfNeeded();
await callAPI('/api/cover_letter', data);
```

---

#### Optional: Password Reset

#### Forgot Password

**Endpoint**: `POST /api/auth/forgot-password`

**Request**:
```json
{
  "email": "user@example.com"
}
```

**Response**:
```json
{
  "success": true,
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

**Note**:
- Email will contain a reset token valid for 1 hour
- Configure email settings in `.env` (see Setup section)
- If email is not configured, the reset link will be logged to console
- Always returns success to prevent email enumeration attacks

#### Reset Password

**Endpoint**: `POST /api/auth/reset-password`

**Request**:
```json
{
  "token": "reset_token_from_email",
  "newPassword": "newPassword123"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Password has been reset successfully. You can now login with your new password."
}
```

**Note**:
- Reset token is single-use and automatically cleared after successful reset
- Token expires after 1 hour
- Requires minimum 8 character password

---

### Method 2: Service Account Authentication

**Best for:** Server-to-server, automation scripts, bots, background jobs

**Complete Flow:**

```
1. POST /api/service-accounts  → clientId + clientSecret (one-time setup)
2. POST /api/auth/token        → accessToken (15 min)
3. POST /api/cover_letter      → Success! (use accessToken)
4. (After 15 min) Repeat step 2 → New accessToken
```

**Why use this?** No individual user accounts needed. One set of credentials for your entire service.

---

#### Step 1: Create Service Account (One-Time Setup)

**Endpoint**: `POST /api/service-accounts`

**Note**: Requires admin authentication. Contact the API administrator to create service accounts.

**Request**:
```json
{
  "name": "Job Application Bot",
  "scopes": ["cover_letter", "resume", "questionAndAnswers"],
  "rateLimit": {
    "requestsPerHour": 5000,
    "requestsPerDay": 50000
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "serviceAccount": {
      "id": "sa_id",
      "name": "Job Application Bot",
      "clientId": "sa_1a2b3c4d5e6f7g8h",
      "clientSecret": "sas_9i8h7g6f5e4d3c2b1a0z9y8x7w6v5u4t",
      "scopes": ["cover_letter", "resume", "questionAndAnswers"]
    },
    "warning": "⚠️ Save the client_secret - it's only shown once!"
  }
}
```

⚠️ **Save your `clientSecret`! It's only shown once.**

---

#### Step 2: Get JWT Access Token

**Endpoint**: `POST /api/auth/token`

**Request**:
```json
{
  "grant_type": "client_credentials",
  "client_id": "sa_1a2b3c4d5e6f7g8h",
  "client_secret": "sas_9i8h7g6f5e4d3c2b1a0z9y8x7w6v5u4t"
}
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 900,
  "scope": "cover_letter resume questionAndAnswers"
}
```

**Now you have a JWT!** Use `access_token` for all API calls.

---

#### Step 3: Call API Endpoints

Same as Method 1 Step 4. Use your JWT in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

#### Step 4: Handle Token Expiry

**Service account tokens expire after 15 minutes.** When you get a 401 error:

1. **Request new token** (Step 2 again) with your clientId/clientSecret
2. Get new JWT access token
3. Retry your API call

**No refresh tokens** - just request a new token when needed.

**Example Refresh Logic** (Pseudocode):
```javascript
async function callAPI(endpoint, data) {
  try {
    return await fetch(endpoint, {
      headers: { Authorization: `Bearer ${jwtToken}` },
      body: JSON.stringify(data)
    });
  } catch (error) {
    if (error.status === 401) {
      // Token expired - get new one
      jwtToken = await getServiceAccountToken(clientId, clientSecret);
      // Retry
      return await fetch(endpoint, {
        headers: { Authorization: `Bearer ${jwtToken}` },
        body: JSON.stringify(data)
      });
    }
    throw error;
  }
}
```

---

### 🧪 Testing & Development

#### Passwordless Email Login

**For testing only** - skip passwords during development.

**Endpoint**: `POST /api/auth/email-login`

**Request**:
```json
{
  "email": "test@example.com"
}
```

**Response**:
```json
{
  "success": true,
  "token": "session_token_here",
  "user": {
    "id": "user_id",
    "email": "test@example.com",
    "name": "test",
    "userType": "user"
  }
}
```

**⚠️ Warning**: This endpoint creates users without passwords. Use only for testing. In production, use regular signup/login.

**Still need JWT?** Yes! Convert the session token using `/api/auth/session-to-jwt` (see Method 1, Step 3).

---

## 📚 API Endpoints

All endpoints require `Authorization: Bearer <access_token>` header.

### AI Generation

#### Generate Cover Letter

**Endpoint**: `POST /api/cover_letter`

**Request**:
```json
{
  "job_id": "job_001",
  "job_details": "We are seeking a Senior Full Stack Developer...",
  "resume_text": "John Doe\nSenior Software Engineer\n...",
  "useAi": "deepseek-chat",
  "company": "TechStart Inc",
  "job_title": "Senior Full Stack Developer",
  "platform": "linkedin",
  "platform_job_id": "3845729103"
}
```

**Response**:
```json
{
  "cover_letter": "Dear Hiring Manager,\n\nI am writing to express...",
  "job_id": "job_001"
}
```

**Required Fields**: `job_id`, `job_details`, `resume_text`, `useAi`

#### Tailor Resume

**Endpoint**: `POST /api/resume`

**Request**:
```json
{
  "job_id": "job_002",
  "job_details": "Looking for a Frontend Engineer with React expertise...",
  "resume_text": "Jane Smith\nSoftware Developer\n...",
  "useAi": "deepseek-chat",
  "company": "WebTech Solutions",
  "job_title": "Frontend Engineer",
  "platform": "indeed"
}
```

**Response**:
```json
{
  "resume": "Jane Smith\nSoftware Developer\n\nProfessional Summary...",
  "job_id": "job_002"
}
```

**Required Fields**: `job_id`, `job_details`, `resume_text`, `useAi`

#### Generate Q&A Responses

**Endpoint**: `POST /api/questionAndAnswers`

**Request**:
```json
{
  "job_id": "job_003",
  "questions": [
    {
      "q": "Why do you want to work for our company?",
      "opts": ["Career growth", "Company culture", "Technical challenges", "All of the above"],
      "type": "radio"
    },
    {
      "q": "How many years of experience do you have?",
      "opts": ["0-2 years", "3-5 years", "6-10 years", "10+ years"],
      "type": "radio"
    }
  ],
  "resume_text": "Sarah Johnson\nProduct Manager\n...",
  "useAi": "deepseek-chat",
  "job_details": "Seeking a Product Manager to lead our mobile app initiative...",
  "company": "MobileApp Inc",
  "job_title": "Product Manager"
}
```

**Response**:
```json
{
  "answers": "Question 1: Recommended answer is 'All of the above'...",
  "job_id": "job_003",
  "questions_count": 2
}
```

**Required Fields**: `job_id`, `questions`, `resume_text`, `useAi`

### User & Authentication

#### Get Current User

**Endpoint**: `GET /api/auth/me`

**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "type": "user",
      "userType": "user",
      "scopes": ["cover_letter", "resume", "questionAndAnswers"]
    },
    "token": {
      "type": "access",
      "expiresAt": "2025-10-15T19:15:00.000Z"
    },
    "rateLimit": {
      "remaining": 498,
      "resetTime": "2025-10-15T19:00:00.000Z"
    }
  }
}
```

### Service Account Management

#### List Service Accounts

**Endpoint**: `GET /api/service-accounts`

**Response**:
```json
{
  "success": true,
  "data": {
    "serviceAccounts": [
      {
        "id": "sa_id",
        "name": "Job Application Bot",
        "clientId": "sa_1a2b3c4d5e6f7g8h",
        "scopes": ["cover_letter", "resume"],
        "isActive": true,
        "createdAt": "2025-10-15T10:00:00.000Z",
        "rateLimit": {
          "requestsPerHour": 5000,
          "requestsPerDay": 50000
        }
      }
    ]
  }
}
```

#### Revoke Service Account

**Endpoint**: `DELETE /api/service-accounts`

**Request**:
```json
{
  "accountId": "674f8a1b2c3d4e5f6a7b8c9d"
}
```

**Response**:
```json
{
  "success": true
}
```

---

## 👥 User Management Workflow

### User Tier System

This API uses a three-tier user system:

| User Type | Description | Default Permissions | Managed By |
|-----------|-------------|---------------------|------------|
| **freetier** | Default for new signups | `cover_letter`, `upload`, `jobs` | Auto-assigned on signup |
| **premium** | Paid/approved users | All permissions enabled | Admin dashboard |
| **admin** | System administrators | Full access + user management | Manual database setup |

### How It Works

1. **User Signs Up** (via your client app)
   - Calls `POST /api/auth/signup`
   - Automatically assigned **freetier** role
   - Limited permissions: can generate cover letters, upload files, manage jobs
   - Cannot access resume tailoring or Q&A features

2. **Admin Reviews New Users**
   - Login to admin dashboard at `http://localhost:3000`
   - View all registered users
   - Review user activity and usage

3. **Admin Upgrades Users**
   - Manually upgrade users from **freetier** to **premium**
   - Grant additional permissions (resume, questionAndAnswers)
   - Set `isPaid: true` for premium users

### Permission Scopes

Available API permissions:

- `cover_letter` - Generate cover letters ✅ (freetier + premium)
- `resume` - Tailor resumes ⚠️ (premium only)
- `questionAndAnswers` - Answer employer questions ⚠️ (premium only)
- `upload` - Upload documents ✅ (freetier + premium)
- `jobs` - Manage job listings ✅ (freetier + premium)
- `admin` - Full administrative access 🔒 (admin only)

---

## 🔧 AI Providers

Supported AI providers for the `useAi` parameter:

- `deepseek-chat` - DeepSeek Chat (recommended)
- `gemini-pro` - Google Gemini Pro
- `claude-3` - Anthropic Claude 3
- `openai` - OpenAI GPT-4

---

## ⚠️ Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

**Common Status Codes**:
- `400` - Bad Request (missing required fields, password too short, invalid token)
- `401` - Unauthorized (missing or invalid token, wrong password)
- `403` - Forbidden (insufficient permissions/scopes)
- `404` - Not Found
- `409` - Conflict (email already exists during signup)
- `500` - Internal Server Error

**Common Auth Errors**:
- `"Password must be at least 8 characters"` - Password too short
- `"User with this email already exists"` - Email already registered (signup)
- `"Invalid email or password"` - Wrong credentials (login)
- `"Invalid or expired reset token"` - Reset token expired or already used

---

## 📖 Interactive Documentation

Visit `http://localhost:3000/api-docs` for Swagger UI with:
- Live API testing
- Request/response examples
- Authentication setup
- Service account creation

---

## 🛠️ Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment** (`.env`):
   ```bash
   # AI Provider API Keys
   CLAUDE_API_KEY=your-claude-api-key
   DEEPSEEK_API_KEY=your-deepseek-api-key
   GEMINI_API_KEY=your-gemini-api-key

   # JWT Authentication
   JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
   JWT_ACCESS_EXPIRY=15m
   JWT_REFRESH_EXPIRY=30d
   JWT_ISSUER=corpus-rag-api

   # MongoDB
   MONGODB_URI=mongodb://localhost:27017/job-assistant

   # Email Configuration (Optional - for password reset emails)
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_SECURE=false
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   EMAIL_FROM=noreply@yourdomain.com
   APP_URL=http://localhost:3000
   ```

   **Note**: Email configuration is optional. If not configured, password reset tokens will be logged to console instead of emailed.

3. **Initialize JWT database**:
   ```bash
   npm run init-jwt
   ```

4. **Start server**:
   ```bash
   npm run dev
   ```

5. **Access**:
   - Web UI: `http://localhost:3000`
   - API Docs: `http://localhost:3000/api-docs`

---

## 📝 Notes

### User Management
- New signups via API are automatically assigned **freetier** role
- Admins manually upgrade users to **premium** via the admin dashboard
- Freetier users have limited API access (cover letters, uploads, jobs only)
- Premium users have full API access (all features enabled)

### Authentication & Sessions
- **JWT access tokens** expire after 15 minutes
- **Session tokens** expire after 30 days (Method 1 only)
- **Service account tokens** expire after 15 minutes (Method 2)
- All API endpoints require JWT access tokens in `Authorization: Bearer <token>` header
- Session tokens must be converted to JWT using `/api/auth/session-to-jwt`

### Rate Limits & Permissions
- Rate limits are enforced per user/service account
- Permission checks enforce user tier restrictions
- Premium features return 403 error for freetier users

---

## 🔒 Security Features

### Password Security
- Passwords hashed with bcrypt (10 salt rounds)
- Minimum 8 character password requirement
- Passwords stored securely, never logged or exposed in responses

### Password Reset Security
- Cryptographically secure reset tokens (32 bytes)
- Tokens expire after 1 hour
- Single-use tokens (automatically cleared after use)
- Email enumeration prevention (always returns success)

### Session Security
- HTTP-only cookies for session tokens
- 30-day session expiration
- Secure session storage in MongoDB

### Account Security
- Users authenticate with email and password
- Each user account has a unique email address
- Account creation checks prevent duplicate emails
- Password reset functionality with secure tokens

---

## 🤝 Support

For issues, feature requests, or questions, please open an issue on GitHub.
