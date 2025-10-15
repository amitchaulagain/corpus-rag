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

**Typical Integration Flow:**

1. **User Registration**
   - Your app calls `POST /api/auth/signup` with user's email/password
   - User is created with **freetier** tier (limited permissions)
   - Returns session token for immediate use

2. **User Authentication**
   - Your app calls `POST /api/auth/login` for returning users
   - Returns session token

3. **API Access**
   - Include session token in `Authorization: Bearer <token>` header
   - Freetier users can access: cover letters, uploads, job management
   - Premium features (resume tailoring, Q&A) require admin upgrade

4. **Admin Approval** (Your workflow)
   - Review new signups in admin dashboard
   - Manually upgrade approved/paid users to **premium**
   - Premium users gain full API access

**Resources:**
- **Interactive Testing**: Visit `http://localhost:3000/api-docs` (Swagger UI)
- **Documentation**: See Authentication section below

---

## 🔐 Authentication

### Authentication Quick Reference

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/api/auth/signup` | POST | Create account with email/password | No |
| `/api/auth/login` | POST | Login with email/password | No |
| `/api/auth/forgot-password` | POST | Request password reset | No |
| `/api/auth/reset-password` | POST | Reset password with token | No |
| `/api/auth/email-login` | POST | Passwordless login (testing) | No |
| `/api/auth/login-jwt` | POST | JWT login with Google OAuth | No |
| `/api/auth/me` | GET | Get current user info | Yes |
| `/api/auth/logout` | POST | Logout current session | Yes |

---

### For User Applications - Email/Password Authentication

User applications can create accounts via the API. New users are automatically assigned the **freetier** role with limited permissions.

#### Signup (Create Account)

**Endpoint**: `POST /api/auth/signup`

**Use Case**: Your client applications call this endpoint to register new users.

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
  "token": "session_token_here",
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
- **Status**: `isPaid: false`
- **Upgrade**: Admins manually upgrade users to `premium` via admin dashboard

**Password Requirements**:
- Minimum 8 characters
- Can include letters, numbers, and special characters

#### Login

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
  "token": "session_token_here",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "userType": "freetier"
  }
}
```

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

### Alternative: Simple Email Login (No Password)

For quick testing, you can use passwordless email login.

**Endpoint**: `POST /api/auth/email-login`

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
  "token": "session_token_here",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "user",
    "userType": "user"
  }
}
```

Use the `session_token` in `Authorization: Bearer <token>` header or store it in cookies.

---

### For API Access (JWT)

The API uses JWT-based authentication with access tokens and refresh tokens.

#### Option 1: User Authentication

**Endpoint**: `POST /api/auth/login-jwt`

**Request**:
```json
{
  "credential": "google_oauth_token"
}
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
    "name": "John Doe",
    "userType": "user"
  }
}
```

#### Option 2: Service Accounts (Machine-to-Machine)

Service accounts are for third-party apps, bots, and automation scripts.

**Step 1: Create Service Account**

**Endpoint**: `POST /api/service-accounts`

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

**Step 2: Get Access Token**

**Endpoint**: `POST /api/auth/token`

**Request** (OAuth 2.0 Client Credentials):
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

#### Token Refresh

When your access token expires (15 minutes), use the refresh token.

**Endpoint**: `POST /api/auth/refresh`

**Request**:
```json
{
  "refreshToken": "your_refresh_token"
}
```

**Response**:
```json
{
  "success": true,
  "accessToken": "new_access_token",
  "refreshToken": "new_refresh_token",
  "expiresIn": 900
}
```

**Note**: Refresh tokens are rotated for security. Always save the new `refreshToken`.

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
- `"This account uses Google Sign-In"` - Account has no password set
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
- Access tokens expire after 15 minutes
- Refresh tokens expire after 30 days
- Session tokens expire after 30 days
- Service account tokens expire after 15 minutes (no refresh)
- All API requests must include `Authorization: Bearer <token>` header

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
- Users can have both password auth and Google OAuth
- Google-only accounts cannot login via password endpoint
- Each user account has a unique email address
- Account creation checks prevent duplicate emails

---

## 🤝 Support

For issues, feature requests, or questions, please open an issue on GitHub.
