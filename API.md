# RAG System API Documentation

## How the API Works

Your RAG system provides a REST API that other applications can use to:
- Upload and manage files
- Query your document corpus using AI
- Manage user data and authentication
- Monitor system health

## API Key Generation

The API uses **API keys** for authentication because:
1. **Security**: No passwords sent over HTTP
2. **Granular permissions**: Each key has specific scopes (read files, write files, query RAG, etc.)
3. **Easy revocation**: Disable keys without changing passwords
4. **Rate limiting**: Track usage per key

### Available Scopes:
- `files:read` - Read user files
- `files:write` - Upload and manage files
- `files:delete` - Delete files
- `corpus:read` - Read corpus information
- `corpus:write` - Manage corpus
- `rag:query` - Query the RAG system
- `rag:import` - Import files to RAG
- `system:status` - Read system status
- `admin` - Full administrative access

## Using the API from Another App

### 1. Deploy Your RAG System
```bash
# Build and deploy to your server
npm run build
# Deploy to your domain: https://your-rag-domain.com
```

### 2. Generate API Key
- Visit your deployed app's UI
- Go to API key generation page
- Create key with required scopes
- **Save the key** - it's only shown once!

### 3. Use from External App

#### JavaScript Example:
```javascript
class RAGClient {
  constructor(apiKey, baseURL = 'https://your-rag-domain.com/api') {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  async request(method, endpoint, data = null) {
    const config = {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    };

    if (data) config.body = JSON.stringify(data);

    const response = await fetch(`${this.baseURL}${endpoint}`, config);
    return await response.json();
  }

  // Upload a file
  async uploadFile(file, userId) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);

    const response = await fetch(`${this.baseURL}/files`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
      body: formData
    });

    return await response.json();
  }

  // Query the RAG system
  async query(userId, question) {
    return await this.request('POST', '/rag/query', {
      userId,
      question
    });
  }
}

// Usage in your external app
const rag = new RAGClient('rag_abc123_your-secret-key');

// Upload user's resume
const fileResult = await rag.uploadFile(resumeFile, 'user@company.com');

// Ask questions about the resume
const answer = await rag.query('user@company.com', 'What skills does this person have?');
console.log(answer.data.answer);
```

#### Python Example:
```python
import requests

class RAGClient:
    def __init__(self, api_key, base_url='https://your-rag-domain.com/api'):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

    def query(self, user_id, question):
        response = requests.post(
            f'{self.base_url}/rag/query',
            headers=self.headers,
            json={'userId': user_id, 'question': question}
        )
        return response.json()

    def upload_file(self, file_path, user_id):
        with open(file_path, 'rb') as f:
            files = {'file': f}
            data = {'userId': user_id}
            headers = {'Authorization': f'Bearer {self.api_key}'}

            response = requests.post(
                f'{self.base_url}/files',
                headers=headers,
                files=files,
                data=data
            )
        return response.json()

# Usage
rag = RAGClient('rag_abc123_your-secret-key')
result = rag.query('user@company.com', 'Summarize this resume')
```

## Dedicated AI Generation API Endpoints

### Cover Letter API
**POST** `/api/cover_letter`

Generate professional cover letters tailored to specific job postings.

**Request:**
```json
{
  "jobDetails": {
    "title": "Software Engineer",
    "company": "Company Name",
    "description": "Job description text...",
    "requirements": ["React", "Node.js", "TypeScript"]
  },
  "userEmail": "user@example.com",
  "customPrompt": "Optional custom prompt override"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "coverLetter": "Dear Hiring Manager...",
    "prompt": "Write a compelling cover letter for this position..."
  }
}
```

**Required scopes:** `rag:query`

### Resume API
**POST** `/api/resume`

Generate tailored resumes optimized for specific job requirements.

**Request:**
```json
{
  "jobDetails": {
    "title": "Senior Software Engineer",
    "company": "TechCorp",
    "description": "Job description...",
    "requirements": ["React", "Node.js", "TypeScript", "AWS"]
  },
  "userEmail": "user@example.com",
  "resumeType": "tailored",
  "customPrompt": "Optional custom prompt override"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "resume": "JOHN DOE\nSoftware Engineer\n...",
    "resumeType": "tailored",
    "prompt": "Create a tailored resume for this position..."
  }
}
```

**Required scopes:** `rag:query`

### Question & Answers API
**POST** `/api/questionAndAnswers`

Generate optimal answers for employer questionnaires and application forms.

**Request:**

The `questions` array contains objects for each question. The API is flexible with the key names for these objects:
- The question text can use the key `q`, `question`, or `text`.
- The options array can use the key `opts` or `options`.

```json
{
  "questions": [
    {
      "q": "What is your experience level with React?",
      "opts": ["Beginner", "Intermediate", "Advanced", "Expert"]
    },
    {
      "question": "Are you willing to work remotely?",
      "options": ["Yes", "No", "Hybrid preferred"]
    }
  ],
  "userEmail": "user@example.com",
  "jobDetails": {
    "title": "Frontend Developer",
    "company": "WebCorp"
  },
  "customPrompt": "Optional custom prompt override"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "answers": "Question 1 → Recommended Answer: Advanced → Rationale: Based on your portfolio...",
    "questionsCount": 2,
    "prompt": "For each of these employer questions..."
  }
}
```

**Required scopes:** `rag:query`

## Complete API Endpoints

### Authentication APIs
- `GET /api/auth/me` - Get current user info
- `GET /api/auth/keys` - List API keys (admin only)
- `POST /api/auth/keys` - Create API key (admin only)
- `DELETE /api/auth/keys/:keyId` - Revoke API key (admin only)
- `GET /api/auth/test-key` - Generate test key (dev only)
- `POST /api/auth/exchange-code` - OAuth token exchange

### Corpus Management APIs
- `GET /api/corpus` - Get/create user corpus with files
- `POST /api/corpus` - Manage corpus (create/cleanup)
- `POST /api/corpus/cleanup` - Clean duplicate corpora
- `POST /api/corpus/create` - Create new corpus
- `GET /api/corpus/files` - List corpus files
- `GET /api/corpus/get` - Get/create corpus (legacy)
- `POST /api/corpus/get` - Get/create corpus (legacy)
- `GET /api/corpus/list` - List all corpora

### RAG (AI Query) APIs
- `POST /api/rag/import` - Import files to RAG system
- `GET /api/rag/operations/[operationId]` - Check import status
- `POST /api/rag/query` - Query AI with RAG context

### File Storage APIs
- `GET /api/storage/browse-all` - Browse all storage files
- `DELETE /api/storage/delete` - Delete user file
- `POST /api/storage/create-folder` - Create user folder
- `GET /api/storage/list` - List user files
- `POST /api/storage/sync` - Sync files to Vertex AI
- `POST /api/storage/upload` - Upload with RAG sync

### Files API (Consolidated)
- `GET /api/files` - List user files
- `POST /api/files` - Upload file
- `GET /api/files/[filename]` - Get file details
- `DELETE /api/files/[filename]` - Delete file
- `PATCH /api/files/[filename]` - Update file content

### System APIs
- `GET /api/system/stats` - Usage statistics
- `GET /api/system/status` - System health check

### Vertex AI APIs
- `GET /api/vertex/files` - List RAG corpus files
- `GET /api/vertex/operations` - Check operation status

### Job Management APIs
- `GET /api/jobs` - List job files
- `GET /api/jobs/[filename]` - Get job file content

### AI Generation APIs
- `POST /api/generate` - Generate cover letters/employer answers (legacy)
- `POST /api/cover_letter` - Generate cover letters
- `POST /api/resume` - Generate tailored resumes
- `POST /api/questionAndAnswers` - Generate employer question answers

### Session & Debug APIs
- `GET /api/session` - Get session API key
- `POST /api/debug/test-import` - Test RAG import
- `GET /api/debug/vertex-config` - Debug Vertex config

## Example Use Cases

### 1. Job Application System
```javascript
// When user uploads resume
const uploadResult = await rag.uploadFile(resumeFile, applicant.email);

// Extract skills automatically
const skills = await rag.query(applicant.email, 'List all technical skills mentioned');

// Generate interview questions
const questions = await rag.query(applicant.email, 'Generate 5 interview questions based on their experience');
```

### 2. Document Analysis Tool
```javascript
// Upload contract/document
await rag.uploadFile(document, client.id);

// Extract key information
const summary = await rag.query(client.id, 'Summarize the main terms and conditions');
const risks = await rag.query(client.id, 'What are the potential risks or red flags?');
```

### 3. Customer Support Bot
```javascript
// Upload product manuals, FAQs
await rag.uploadFile(manual, 'support-docs');

// Answer customer questions
const answer = await rag.query('support-docs', customerQuestion);
```

### 4. Job Application Assistant
```javascript
// Generate cover letter for job application
const coverLetter = await rag.request('POST', '/cover_letter', {
  jobDetails: {
    title: 'Senior Software Engineer',
    company: 'TechCorp',
    description: 'We are looking for an experienced developer...',
    requirements: ['React', 'Node.js', 'TypeScript']
  },
  userEmail: 'candidate@email.com'
});

// Generate tailored resume
const resume = await rag.request('POST', '/resume', {
  jobDetails: {
    title: 'Senior Software Engineer',
    company: 'TechCorp',
    requirements: ['React', 'Node.js', 'TypeScript']
  },
  userEmail: 'candidate@email.com',
  resumeType: 'tailored'
});

// Get answers for employer questions
const answers = await rag.request('POST', '/questionAndAnswers', {
  questions: [
    { q: 'What is your experience level?', opts: ['Entry', 'Mid', 'Senior'] },
    { q: 'Are you willing to relocate?', opts: ['Yes', 'No', 'Maybe'] }
  ],
  userEmail: 'candidate@email.com',
  jobDetails: { title: 'Senior Software Engineer', company: 'TechCorp' }
});
```

## Rate Limiting

- **100 requests per hour** per API key
- Rate limit headers in responses:
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

## Response Format

All responses follow this structure:
```json
{
  "success": boolean,
  "data": object | null,
  "error": string | null,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Error Codes

- `400` - Bad Request
- `401` - Unauthorized (invalid API key)
- `403` - Forbidden (insufficient scopes)
- `404` - Not Found
- `429` - Rate limit exceeded
- `500` - Server error

## Security Notes

- API keys are **only shown once** during creation
- Use HTTPS in production
- Store API keys securely (environment variables, secrets manager)
- Revoke unused keys immediately
- Use minimal scopes per key (principle of least privilege)