# 📚 Swagger API Documentation

## Overview

The RAG System now includes comprehensive API documentation and testing capabilities using Swagger UI. This provides an interactive interface for exploring and testing all available API endpoints.

## Access Points

### 🚀 Official Swagger UI
- **URL**: [http://localhost:3000/swagger](http://localhost:3000/swagger)
- **Features**: 
  - Official Swagger UI interface
  - Interactive API testing
  - Complete OpenAPI 3.0 specification
  - Built-in authentication support

### 🧪 Custom API Tester
- **URL**: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
- **Features**:
  - Custom-built API testing interface
  - API key generation and management
  - Streamlined testing experience
  - Integrated with authentication

### 📋 JSON Specification
- **URL**: [http://localhost:3000/api/swagger.json](http://localhost:3000/api/swagger.json)
- **Features**:
  - Raw OpenAPI 3.0 JSON specification
  - Can be imported into other tools (Postman, Insomnia, etc.)

## Authentication

### API Key Authentication
All API endpoints require authentication using API keys in the following format:

```
Authorization: Bearer rag_[keyId]_[secret]
```

### Getting an API Key

1. **Via Main App**:
   - Authenticate with Google OAuth
   - Go to "API Tester" tab
   - Click "🔑 Load" button to auto-load a test key
   - Or use "Generate API Key" for custom scopes

2. **Via Swagger UI**:
   - Click the "Authorize" button in Swagger UI
   - Enter your API key in the format above
   - All subsequent requests will include authentication

## API Endpoints Overview

### 🔐 Authentication
- `GET /api/auth/me` - Get current user information

### 📁 Files
- `GET /api/files` - List user files
- `POST /api/files` - Upload a file
- `GET /api/files/{filename}` - Get file information
- `DELETE /api/files/{filename}` - Delete a file

### 📚 Corpus Management
- `GET /api/corpus` - Get user corpus information
- `POST /api/corpus` - Create or manage corpus

### 🤔 RAG System
- `POST /api/rag/query` - Query documents with AI
- `POST /api/rag/import` - Import files to RAG system
- `GET /api/rag/operations/{operationId}` - Check import status

### 📊 System
- `GET /api/system/status` - System health check
- `GET /api/system/stats` - Usage statistics

## Testing Examples

### 1. Health Check (No Auth Required)
```bash
curl -X GET "http://localhost:3000/api/system/status"
```

### 2. List Files (Auth Required)
```bash
curl -X GET "http://localhost:3000/api/files?userId=your-email@example.com" \
  -H "Authorization: Bearer rag_[keyId]_[secret]"
```

### 3. Query RAG System
```bash
curl -X POST "http://localhost:3000/api/rag/query" \
  -H "Authorization: Bearer rag_[keyId]_[secret]" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "your-email@example.com",
    "question": "What skills do I have?",
    "maxResults": 5
  }'
```

### 4. Upload File
```bash
curl -X POST "http://localhost:3000/api/files" \
  -H "Authorization: Bearer rag_[keyId]_[secret]" \
  -F "file=@/path/to/your/resume.pdf" \
  -F "userId=your-email@example.com"
```

## Features

### 🎯 Interactive Testing
- Try out API calls directly in the browser
- Real-time response viewing
- Parameter validation
- Request/response examples

### 🔧 Developer Tools
- Complete OpenAPI 3.0 specification
- Export for external tools
- Code generation support
- Schema validation

### 🔒 Security
- Bearer token authentication
- Scoped API keys
- User isolation
- Request validation

## Navigation

From the main RAG Dashboard, you can access:
- **📚 API Docs** - Opens Swagger UI in new tab
- **🧪 API Tester** - Opens custom API tester

## Development

### Adding New Endpoints
1. Update `src/lib/openapi-spec.ts`
2. Add endpoint implementation in `src/routes/api/`
3. Test using Swagger UI
4. Update documentation

### Customizing Swagger UI
The Swagger UI can be customized by modifying:
- `src/routes/swagger/+page.svelte` - Main Swagger page
- Static assets in `static/swagger-ui/`
- OpenAPI spec in `src/lib/openapi-spec.ts`

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Ensure API key format is correct: `Bearer rag_[keyId]_[secret]`
   - Check that the user is authenticated in the main app
   - Verify API key scopes include required permissions

2. **CORS Issues**
   - Swagger UI runs on the same domain, so CORS shouldn't be an issue
   - For external tools, ensure proper CORS headers

3. **Missing Endpoints**
   - Check that the endpoint is defined in `openapi-spec.ts`
   - Verify the route exists in `src/routes/api/`
   - Restart the dev server after changes

### Support
For issues or questions, check the main application logs or create an issue in the project repository.
