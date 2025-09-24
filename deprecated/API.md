# RAG System API Documentation

## Overview

The RAG System API provides programmatic access to all the features available in the web UI, including file management, corpus operations, and AI-powered document querying.

## Base URL

```
https://your-domain.com/api
```

## Authentication

The API uses API key authentication. Include your API key in the `Authorization` header:

```
Authorization: Bearer rag_[key_id]_[secret]
```

### Getting an API Key

1. Use the UI to generate an API key with required scopes
2. Store the key securely - it will only be shown once

### API Scopes

- `files:read` - Read user files
- `files:write` - Upload and manage files
- `files:delete` - Delete files
- `corpus:read` - Read corpus information
- `corpus:write` - Manage corpus
- `rag:query` - Query the RAG system
- `rag:import` - Import files to RAG
- `system:status` - Read system status
- `admin` - Full administrative access

## Rate Limiting

- 100 requests per hour per API key
- Rate limit headers included in responses:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

## Response Format

All API responses follow this format:

```json
{
  "success": boolean,
  "data": object | null,
  "error": string | null,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "requestId": "abc123"
}
```

## Endpoints

### Authentication

#### Get Current User Info
```http
GET /api/auth/me
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user@example.com",
      "email": "user@example.com",
      "scopes": ["files:read", "files:write", "rag:query"]
    },
    "apiKey": {
      "id": "abc123",
      "name": "My App Key",
      "scopes": ["files:read", "files:write", "rag:query"],
      "lastUsed": "2024-01-01T00:00:00.000Z"
    },
    "rateLimit": {
      "remaining": 95,
      "resetTime": 1704067200000
    }
  }
}
```

#### Manage API Keys
```http
GET /api/auth/keys           # List API keys (admin scope required)
POST /api/auth/keys          # Create new API key (admin scope required)
DELETE /api/auth/keys/{id}   # Revoke API key (admin scope required)
```

### File Management

#### List Files
```http
GET /api/files?userId=user@example.com
```

**Response:**
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "id": "gs://bucket/user@example.com/resume.pdf",
        "name": "resume.pdf",
        "size": 1024000,
        "mimeType": "application/pdf",
        "userId": "user@example.com",
        "fileId": "gs://bucket/user@example.com/resume.pdf",
        "fullPath": "user@example.com/resume.pdf",
        "created": "2024-01-01T00:00:00.000Z"
      }
    ],
    "count": 1
  }
}
```

#### Upload File
```http
POST /api/files
Content-Type: multipart/form-data

file: [File]
userId: user@example.com
replaceExisting: false
```

**Response:**
```json
{
  "success": true,
  "data": {
    "file": {
      "id": "gs://bucket/user@example.com/resume.pdf",
      "name": "resume.pdf",
      "size": 1024000,
      "mimeType": "application/pdf",
      "userId": "user@example.com",
      "fileId": "gs://bucket/user@example.com/resume.pdf",
      "fullPath": "user@example.com/resume.pdf",
      "created": "2024-01-01T00:00:00.000Z"
    },
    "ragImport": {
      "success": true,
      "operationId": "operation-123",
      "error": null
    }
  }
}
```

#### Get File Info
```http
GET /api/files/resume.pdf?userId=user@example.com
```

#### Delete File
```http
DELETE /api/files/resume.pdf?userId=user@example.com
```

### Corpus Management

#### Get User Corpus
```http
GET /api/corpus?userId=user@example.com
```

**Response:**
```json
{
  "success": true,
  "data": {
    "corpusId": "corpus-abc123",
    "userId": "user@example.com",
    "displayName": "JobBot_User_user@example.com_Corpus",
    "exists": true,
    "createTime": "2024-01-01T00:00:00.000Z",
    "fileCount": 1,
    "files": [
      {
        "id": "file-123",
        "name": "resume.pdf",
        "state": "ACTIVE",
        "sizeBytes": "1024000",
        "createTime": "2024-01-01T00:00:00.000Z",
        "gcsSource": "gs://bucket/user@example.com/resume.pdf"
      }
    ]
  }
}
```

#### Manage Corpus
```http
POST /api/corpus
Content-Type: application/json

{
  "userId": "user@example.com",
  "action": "get_or_create" // or "cleanup"
}
```

#### List Corpus Files
```http
GET /api/corpus/files?userId=user@example.com
```

### RAG Operations

#### Query RAG
```http
POST /api/rag/query
Content-Type: application/json

{
  "userId": "user@example.com",
  "question": "What skills do I have?",
  "context": "Focus on technical skills",
  "maxResults": 5
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "answer": "Based on your resume, you have strong technical skills in...",
    "sources": ["resume.pdf"],
    "processingTime": 1500,
    "corpusId": "corpus-abc123"
  }
}
```

#### Import Files to RAG
```http
POST /api/rag/import
Content-Type: application/json

{
  "userId": "user@example.com",
  "cloudStorageUris": [
    "gs://bucket/user@example.com/resume.pdf"
  ],
  "waitForCompletion": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Import started for 1 files",
    "operationId": "operation-123",
    "filesCount": 1,
    "corpusId": "corpus-abc123"
  }
}
```

#### Check Operation Status
```http
GET /api/rag/operations/operation-123
```

**Response:**
```json
{
  "success": true,
  "data": {
    "operationId": "operation-123",
    "done": true,
    "progress": 100,
    "error": null,
    "result": {}
  }
}
```

### System Monitoring

#### System Status
```http
GET /api/system/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "uptime": 3600,
    "responseTime": 150,
    "services": {
      "storage": "healthy",
      "vertexAI": "healthy",
      "database": "healthy"
    },
    "environment": {
      "projectId": "my-project",
      "region": "us-east4",
      "bucket": "my-bucket"
    },
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Usage Statistics
```http
GET /api/system/stats?userId=user@example.com
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user@example.com",
    "filesUploaded": 1,
    "storageUsed": 1024000,
    "queriesCount": 50,
    "lastActivity": "2024-01-01T00:00:00.000Z",
    "corpus": {
      "exists": true,
      "fileCount": 1
    },
    "monthlyUsage": {
      "uploads": 1,
      "queries": 50,
      "storageUsed": 1024000
    },
    "limits": {
      "maxFiles": 100,
      "maxStorageBytes": 1073741824,
      "maxQueriesPerDay": 1000
    },
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid API key |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |

## Example Usage

### JavaScript/Node.js

```javascript
class RAGClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://your-domain.com/api';
  }

  async request(method, endpoint, data = null) {
    const config = {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.body = JSON.stringify(data);
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, config);
    return await response.json();
  }

  async uploadFile(file, userId) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);

    const response = await fetch(`${this.baseURL}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: formData
    });

    return await response.json();
  }

  async query(userId, question) {
    return await this.request('POST', '/rag/query', {
      userId,
      question
    });
  }

  async getStatus() {
    return await this.request('GET', '/system/status');
  }
}

// Usage
const client = new RAGClient('your-api-key');

// Upload a file
const fileInput = document.getElementById('file');
const result = await client.uploadFile(fileInput.files[0], 'user@example.com');

// Query the RAG system
const answer = await client.query('user@example.com', 'What skills do I have?');

// Check system status
const status = await client.getStatus();
```

### Python

```python
import requests
import json

class RAGClient:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = 'https://your-domain.com/api'
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

    def request(self, method, endpoint, data=None):
        url = f'{self.base_url}{endpoint}'
        response = requests.request(method, url, headers=self.headers, json=data)
        return response.json()

    def upload_file(self, file_path, user_id):
        url = f'{self.base_url}/files'
        headers = {'Authorization': f'Bearer {self.api_key}'}

        with open(file_path, 'rb') as f:
            files = {'file': f}
            data = {'userId': user_id}
            response = requests.post(url, headers=headers, files=files, data=data)

        return response.json()

    def query(self, user_id, question):
        return self.request('POST', '/rag/query', {
            'userId': user_id,
            'question': question
        })

    def get_status(self):
        return self.request('GET', '/system/status')

# Usage
client = RAGClient('your-api-key')

# Upload a file
result = client.upload_file('/path/to/resume.pdf', 'user@example.com')

# Query the RAG system
answer = client.query('user@example.com', 'What skills do I have?')

# Check system status
status = client.get_status()
```

## CORS

The API supports Cross-Origin Resource Sharing (CORS) for browser-based applications:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

## Webhooks (Coming Soon)

Webhook support for asynchronous operations:

- `file.uploaded` - Triggered when a file is uploaded
- `rag.import.completed` - Triggered when RAG import completes
- `rag.import.failed` - Triggered when RAG import fails
- `corpus.created` - Triggered when a new corpus is created

## SDKs

Official SDKs available for:
- JavaScript/TypeScript (Node.js & Browser)
- Python
- Go (Coming Soon)
- Java (Coming Soon)