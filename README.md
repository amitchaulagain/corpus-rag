# 🚀 RAG System - Super Easy Setup

A modern RAG (Retrieval-Augmented Generation) system where users can upload resumes and ask questions about them using AI.

## ⚡ Quick Start (3 Commands)

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

## 🔧 Getting Your Credentials

### Google Cloud Console Setup (5 minutes)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. **Enable APIs**: Vertex AI API + Cloud Storage API
4. **Create OAuth Client**: APIs & Services → Credentials → Create OAuth Client ID
5. **Create Storage Bucket**: Cloud Storage → Create Bucket
6. **Authenticate**: Run `gcloud auth application-default login`

### OAuth Settings
- **Application type**: Web application
- **Authorized origins**: `http://localhost:3000`
- **Authorized redirect URIs**: `http://localhost:3000`

## ✨ Features

- 🔐 **Google Login** - Secure authentication
- 📄 **One Resume Per User** - Upload, replace, or delete
- 🧠 **AI Questions** - Ask anything about uploaded resumes
- 🛡️ **Private & Secure** - Each user gets isolated storage
- ⚡ **Modern Tech** - SvelteKit 5 + TypeScript + Bun

## 📱 How to Use

1. **🔐 Sign in** with your Google account
2. **📤 Upload** your resume (PDF, DOCX, TXT)
3. **❓ Ask questions** about your resume using AI
4. **🗑️ Delete/Replace** anytime (1 resume per user)

## 🚨 Troubleshooting

### Can't Login?
```bash
gcloud auth application-default login
```

### Upload Fails?
- Check file size (max 10MB)
- Use supported formats: PDF, DOCX, TXT, MD
- Only 1 resume allowed per user

### AI Not Working?
- Make sure Vertex AI API is enabled in Google Cloud
- Check if your file uploaded successfully

### Still Having Issues?
```bash
# Fresh install
rm -rf node_modules
bun install
bun run dev
```

## 📄 License
MIT License

