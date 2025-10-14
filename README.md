# Job Application Assistant API

AI-powered API for automating job application tasks: cover letters, resume tailoring, and employer question answering.

**Base URL**: `http://localhost:3000`

---

## 🚀 Quick Start

### Web UI Access
1. Start the server: `npm run dev`
2. Navigate to `http://localhost:3000`
3. Enter your email to login (no password required)
4. Access the admin dashboard and API documentation

### API Access
- **Interactive Testing**: Visit `http://localhost:3000/api-docs` (Swagger UI)
- **Programmatic Access**: Use JWT authentication (see below)

---

## 🔐 Authentication

### For Web UI (Simple Email Login)

The web interface uses session-based authentication with a simple email login.

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

## 🎯 Available Scopes

When creating service accounts, you can grant these permissions:

- `cover_letter` - Generate cover letters
- `resume` - Tailor resumes
- `questionAndAnswers` - Answer employer questions
- `upload` - Upload documents
- `jobs` - Manage job listings
- `admin` - Full administrative access

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
- `400` - Bad Request (missing required fields)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions/scopes)
- `404` - Not Found
- `500` - Internal Server Error

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
   ```

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

- Access tokens expire after 15 minutes
- Refresh tokens expire after 30 days
- Service account tokens expire after 15 minutes (no refresh)
- Rate limits are enforced per user/service account
- All API requests must include `Authorization: Bearer <token>` header

---

## 🤝 Support

For issues, feature requests, or questions, please open an issue on GitHub.
