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

## Key API Endpoints

### Authentication
- `GET /api/auth/me` - Get current user info
- `GET /api/auth/keys` - List API keys (admin only)
- `POST /api/auth/keys` - Create API key (admin only)

### File Management
- `GET /api/files?userId=user@example.com` - List files
- `POST /api/files` - Upload file
- `DELETE /api/files/{filename}?userId=user@example.com` - Delete file

### RAG Operations
- `POST /api/rag/query` - Ask questions about documents
- `POST /api/rag/import` - Import files to RAG system
- `GET /api/rag/operations/{operationId}` - Check import status

### System
- `GET /api/system/status` - Health check
- `GET /api/system/stats` - Usage statistics

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