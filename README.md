# TypeScript RAG System with Google Cloud Storage

A modern TypeScript-based RAG (Retrieval-Augmented Generation) system built with SvelteKit, Google Cloud Storage, and Vertex AI. Features secure user authentication, single resume management, and intelligent document querying.

## 🚀 Features

- **🔐 Google OAuth Authentication** - Secure user login with identity-only permissions
- **📄 Single Resume Management** - Upload, delete, and replace resume with drag-and-drop interface
- **☁️ Google Cloud Storage** - Secure file storage with user isolation (`users/{email}/`)
- **🧠 Vertex AI RAG** - Intelligent document querying using Google's RAG technology
- **⚡ Modern Stack** - SvelteKit 5 + TypeScript + Bun runtime
- **🛡️ Security First** - Server-side authentication, user folder isolation, file validation

## 🏗️ Architecture

### Authentication Flow
1. **Users** authenticate via Google OAuth (identity only - no storage permissions)
2. **Server** uses admin's Google Cloud credentials for storage operations
3. **Files** stored in isolated folders: `users/{user-email}/resume.{ext}`

### Security Model
- ✅ Users can't access other users' files
- ✅ Users can't access Google Cloud resources directly
- ✅ Server-side validation and file management
- ✅ Single resume limit prevents storage abuse

## 📋 Prerequisites

- **Node.js 18+** and **Bun** runtime
- **Google Cloud CLI** installed and authenticated
- Access to Google Cloud project `gen-lang-client-0738357189`
- **Google Cloud Storage bucket**: `rag-storage-439974099982`
- **Vertex AI API** enabled for RAG functionality

## 🚀 Quick Start

### 1. Clone and Setup
```bash
git clone <repository>
cd corpus-rag/rag-ui

# Install dependencies
bun install
```

### 2. Authentication Setup
```bash
# Authenticate with Google Cloud (admin account)
gcloud auth application-default login
gcloud config set project gen-lang-client-0738357189
```

### 3. Environment Configuration
Create `.env` file:
```bash
GOOGLE_CLOUD_PROJECT_ID=gen-lang-client-0738357189
GOOGLE_CLOUD_BUCKET_NAME=rag-storage-439974099982
GOOGLE_APPLICATION_CREDENTIALS=/home/wagle/.config/gcloud/application_default_credentials.json
```

### 4. Run Development Server
```bash
bun run dev
```

Visit **http://localhost:3000** to access the application.

## 📱 Usage

### For Users
1. **🔐 Login** - Click "Sign in with Google" (identity verification only)
2. **📤 Upload** - Drag and drop your resume or click to select
3. **❓ Query** - Ask questions about your uploaded resume
4. **🗑️ Manage** - Delete or replace your resume anytime

### For Administrators
- **User Isolation**: Each user gets a secure folder: `users/{email}/`
- **Storage Management**: Files stored in Google Cloud Storage bucket
- **Access Control**: Only authenticated users can access their own files

## 🛠️ Development

### Project Structure
```
rag-ui/
├── src/
│   ├── lib/
│   │   ├── components/     # Svelte components
│   │   ├── storage-client.ts  # Cloud Storage client
│   │   └── rag-client.ts      # Vertex AI RAG client
│   └── routes/
│       ├── api/               # API endpoints
│       │   ├── storage/       # Storage operations
│       │   └── rag/          # RAG operations
│       └── +page.svelte      # Main application
├── .env                      # Environment variables
└── package.json
```

### API Endpoints

#### Storage Operations
- `POST /api/storage/upload` - Upload resume (1 file limit)
- `GET /api/storage/list` - List user's files
- `DELETE /api/storage/delete` - Delete user's resume
- `POST /api/storage/create-folder` - Create user folder

#### RAG Operations
- `POST /api/rag/query` - Query uploaded documents
- `POST /api/rag/import` - Import files to RAG system

### Security Features

#### Authentication
- ✅ Google OAuth for user identity
- ✅ Server-side Google Cloud authentication
- ✅ No storage permissions granted to users

#### File Management
- ✅ User folder isolation: `users/{email}/`
- ✅ Single file limit per user
- ✅ File type validation
- ✅ Secure server-side operations

## 🔧 Configuration

### Google Cloud Setup
1. **OAuth Client**: Configure in Google Cloud Console
2. **Storage Bucket**: `rag-storage-439974099982` in `us-east4`
3. **Vertex AI**: Enable Vertex AI API for RAG functionality

### Environment Variables
```bash
GOOGLE_CLOUD_PROJECT_ID=gen-lang-client-0738357189
GOOGLE_CLOUD_BUCKET_NAME=rag-storage-439974099982
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
```

## 📚 Migration from Python

The original Python Flask implementation has been moved to the `deprecated/` folder. This TypeScript implementation provides:

- ✅ **Better Performance** - Modern JavaScript runtime with Bun
- ✅ **Enhanced Security** - Proper authentication separation
- ✅ **Modern UI** - Svelte 5 with TypeScript
- ✅ **Maintainability** - Clean architecture and type safety

## 🚨 Troubleshooting

### Common Issues

**Authentication Errors**
```bash
# Re-authenticate
gcloud auth application-default login
```

**Storage Permission Denied**
- Ensure admin account has Storage Admin role
- Verify bucket exists and is accessible

**File Upload Fails**
- Check file size limits (10MB default)
- Verify file type is supported (.pdf, .txt, .docx, .md)
- Ensure user has single file limit not exceeded

**RAG Queries Fail**
- Verify Vertex AI API is enabled
- Check if file was properly imported to RAG system
- Ensure user has uploaded a resume

### Development Issues

**Dependencies**
```bash
# Reinstall dependencies
rm -rf node_modules
bun install
```

**Environment**
```bash
# Check environment variables
cat .env
```

**Server Errors**
```bash
# Check server logs
bun run dev
```

## 📄 License

This project is licensed under the MIT License.

