# 🤖 Job Hunting Bot - RAG Dashboard

A comprehensive RAG (Retrieval-Augmented Generation) system for job hunting with per-user corpus isolation, real-time file management, and AI-powered resume analysis.

## ⚡ Quick Start

```bash
git clone https://github.com/amitchaulagain/corpus-rag.git
cd corpus-rag/rag-ui
bun install && bun run setup
```

**Update the `.env` file with your Google Cloud credentials, then:**

```bash
bun run dev
```

**That's it!** 🎉 Visit **http://localhost:3000**

## 🔧 Google Cloud Setup

### Required APIs & Services
1. **Vertex AI API** - For RAG corpus and AI queries
2. **Cloud Storage API** - For file storage
3. **OAuth 2.0** - For user authentication

### OAuth Configuration
- **Application type**: Web application
- **Authorized origins**: `http://localhost:3000`
- **Authorized redirect URIs**: `http://localhost:3000`

### Important: Regional Setup
- **Vertex AI RAG**: Use `us-east4` region (supports all RAG operations)
- **Cloud Storage**: Any region compatible with your project
- **us-central1**: Requires allowlisting for new projects

## ✨ Features

### 🏗️ **Per-User Corpus Isolation**
- Individual RAG corpus for each user
- Automatic corpus creation and management
- Deduplication to prevent multiple corpora

### 📁 **Comprehensive File Management**
- **Cloud Storage Browser**: Navigate files and folders hierarchically
- **Vertex AI Files Viewer**: Monitor RAG file status and sync
- **Real-time Operations**: Track import progress with auto-refresh

### 🔄 **Smart Sync System**
- Auto-import files to Vertex AI after upload
- Manual sync capabilities for individual files or bulk operations
- Operation status monitoring with 5-second polling

### 🎨 **Modern Dashboard**
- **5-Tab Interface**: Upload, Query, Corpus Management, File Manager, System Logs
- **Real-time Console**: Live logging of all operations
- **Accessibility Support**: Keyboard navigation and ARIA compliance

### 🧠 **AI-Powered Analysis**
- Resume analysis using Vertex AI RAG Engine
- Context-aware questions and answers
- Intelligent file chunking and embedding

## 📱 Usage Guide

### 1. **Authentication & Setup**
- Sign in with Google account
- System automatically creates user folder and corpus
- View your corpus details in the dashboard

### 2. **File Upload & Management**
- Upload resumes (PDF, DOCX, TXT, MD)
- Files auto-sync to Vertex AI RAG
- Monitor import progress in real-time

### 3. **File Manager**
- Browse all cloud storage files
- View Vertex AI RAG file status
- Manual sync individual files or bulk operations

### 4. **AI Query**
- Ask questions about uploaded documents
- Get AI-powered insights and analysis
- Context-aware responses from your personal corpus

### 5. **System Monitoring**
- Real-time console logs
- Operation status tracking
- Corpus management and cleanup tools

## 🚨 Troubleshooting

### Authentication Issues
```bash
# Refresh Google Cloud credentials
gcloud auth application-default login

# Check current authentication
gcloud auth list
```

### RAG Import Failures
- **404 Errors**: Ensure using `us-east4` region (not `us-central1`)
- **Corpus Not Found**: Check if corpus exists in Corpus Management tab
- **API Errors**: Verify Vertex AI API is enabled in Google Cloud Console

### File Upload Issues
- **Size Limits**: Max 10MB per file
- **Supported Formats**: PDF, DOCX, TXT, MD
- **Storage Permissions**: Ensure Cloud Storage API is enabled

### Vertex AI RAG Region Issues
- **us-central1**: Requires allowlisting for new projects
- **us-east4**: Recommended region (full RAG support)
- **Solution**: Use `us-east4` for all Vertex AI operations

### Operation Monitoring
- Check **System Logs** tab for real-time error details
- Use **File Manager** to verify sync status
- Monitor **Operations Status** panel for import progress

### Fresh Install
```bash
# Complete reset
rm -rf node_modules .env
bun install
bun run setup
# Update .env with correct credentials
bun run dev
```

## 🛠️ Technical Architecture

### Backend Structure
- **SvelteKit 5**: Modern full-stack framework
- **TypeScript**: Type-safe development
- **Google Cloud Integration**: Vertex AI + Cloud Storage
- **Bun Runtime**: Fast JavaScript runtime

### Key Components
- **Corpus Manager**: Per-user RAG corpus lifecycle
- **RAG Client**: Vertex AI integration with retry logic
- **Storage Client**: Cloud Storage file operations
- **Real-time Monitoring**: Operation status tracking

### API Endpoints
- `/api/corpus/*`: Corpus management (create, list, cleanup)
- `/api/rag/*`: RAG operations (import, query)
- `/api/storage/*`: File management (upload, sync, browse)
- `/api/vertex/*`: Vertex AI monitoring (files, operations)

## 🔐 Security Features

- **OAuth 2.0**: Secure Google authentication
- **Per-User Isolation**: Individual corpus and storage
- **No Credential Exposure**: Server-side API key management
- **Input Validation**: File type and size restrictions

## 📊 Performance Optimization

- **Deduplication**: Prevents multiple corpus creation
- **Auto-Retry**: Intelligent error recovery
- **Real-time Updates**: Efficient operation monitoring
- **Chunking Strategy**: Optimized for resume analysis

## 📄 License
MIT License

---

**Built with ❤️ for job hunters using modern RAG technology**

