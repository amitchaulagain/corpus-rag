# Installation Guide - Corpus RAG

Complete step-by-step guide to install and run this application on a new machine.

## 📋 Prerequisites

- **Node.js** v18+
- **MongoDB** v7.0+
- **Google OAuth Client** credentials
- **AI Provider API Keys** (Claude, DeepSeek, Gemini)

---

## 🔧 Step 1: Install System Dependencies

### Ubuntu/Debian

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MongoDB 7.0
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

### macOS

```bash
# Install Node.js
brew install node

# Install MongoDB
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0
```

### Verify Installations

```bash
node --version  # Should be v18+
npm --version
mongod --version  # Should be v7.0+
mongosh --version
```

---

## 📥 Step 2: Clone and Install Application

```bash
# Clone repository
git clone https://github.com/amitchaulagain/corpus-rag.git
cd corpus-rag

# Install dependencies
npm install
```

---

## 🔑 Step 3: Configure Environment Variables

Create `.env` file in project root:

```bash
cp .env.example .env
nano .env
```

Add the following configuration:

```bash
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=corpus_rag

# Google OAuth (Required)
# Get from: https://console.cloud.google.com/apis/credentials
PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=your-client-secret

# AI Provider API Keys
CLAUDE_API_KEY=sk-ant-api03-...
DEEPSEEK_API_KEY=sk-...
GEMINI_API_KEY=AIza...
```

### 🔐 Getting Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select existing
3. Click **"CREATE CREDENTIALS"** → **"OAuth client ID"**
4. Application type: **Web application**
5. Name: `corpus-rag-local`
6. **Authorized JavaScript origins**:
   - `http://localhost:3000`
7. Click **CREATE**
8. Copy **Client ID** and **Client Secret** to `.env`

### 🤖 Getting AI API Keys

- **Claude**: https://console.anthropic.com/
- **DeepSeek**: https://platform.deepseek.com/
- **Gemini**: https://aistudio.google.com/app/apikey

---

## 💾 Step 4: Initialize Database

The database and collections are created automatically on first run, but you can verify:

```bash
# Test MongoDB connection
mongosh

# In mongosh:
show dbs
use corpus_rag
show collections
exit
```

### Create Admin Users

There are two ways to create the first admin:

#### Option A: Login with Google OAuth (Automatic)

Pre-authorized admin emails are hardcoded in:
- `puskarwagle17@gmail.com`
- `achaulagain123@gmail.com`

These emails automatically become admins on first login.

#### Option B: Manually Add Admin (Alternative)

```bash
# In mongosh
use corpus_rag

db.users.insertOne({
  email: "youremail@gmail.com",
  name: "Your Name",
  userType: "admin",
  isPaid: true,
  apiPermissions: {
    cover_letter: true,
    resume: true,
    questionAndAnswers: true,
    upload: true,
    jobs: true
  },
  createdAt: new Date(),
  lastLogin: new Date()
})
```

---

## 🚀 Step 5: Run the Application

### Development Mode

```bash
npm run dev
```

The app will start on: **http://localhost:3000**

### Production Mode

```bash
# Build the application
npm run build

# Run production server
npm run preview
```

---

## ✅ Step 6: Verify Installation

### 1. Check MongoDB

```bash
# Check MongoDB is running
sudo systemctl status mongod

# Connect and verify database
mongosh corpus_rag --eval "db.getCollectionNames()"
```

Expected output:
```
[ 'users', 'sessions', 'usage', 'user_platforms', 'jobs', 'job_applications' ]
```

### 2. Check Application

1. Open browser: **http://localhost:3000**
2. You should see login page with Google Sign-In button
3. Click **"Sign in with Google"**
4. Select your admin account
5. You should be redirected to **/dashboard**

### 3. Check API Endpoints

```bash
# Test health (requires authentication token first)
curl http://localhost:3000/api/admin/stats \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

---

## 🔧 Troubleshooting

### MongoDB Connection Failed

```bash
# Check if MongoDB is running
sudo systemctl status mongod

# Check MongoDB logs
sudo journalctl -u mongod -n 50

# Restart MongoDB
sudo systemctl restart mongod
```

### Port 3000 Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change port in vite.config.ts
```

### Google OAuth Error: "redirect_uri_mismatch"

1. Go to Google Cloud Console
2. Edit OAuth client
3. Add **http://localhost:3000** to Authorized JavaScript origins
4. Save and wait 5 minutes for changes to propagate

### Module Not Found Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### MongoDB Indexes Not Created

```bash
# Manually create indexes
mongosh corpus_rag

# Run these commands:
db.users.createIndex({ email: 1 }, { unique: true })
db.sessions.createIndex({ token: 1 }, { unique: true })
db.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
db.jobs.createIndex({ userId: 1, platform: 1, platformJobId: 1 }, { unique: true })
```

---

## 📁 Project Structure

```
corpus-rag/
├── src/
│   ├── lib/
│   │   ├── db/
│   │   │   ├── mongodb.ts          # MongoDB connection + indexes
│   │   │   ├── user-service.ts     # User/session operations
│   │   │   └── job-service.ts      # Job/application operations
│   │   ├── components/
│   │   │   ├── GoogleAuth.svelte   # Google OAuth component
│   │   │   └── AdminGuard.svelte   # Admin protection
│   │   └── multi-provider-service.ts # AI provider integration
│   ├── routes/
│   │   ├── api/
│   │   │   ├── cover_letter/       # Cover letter generation
│   │   │   ├── resume/             # Resume generation
│   │   │   ├── questionAndAnswers/ # Q&A generation
│   │   │   ├── auth/               # Authentication
│   │   │   ├── users-json/         # User management
│   │   │   └── jobs/               # Job tracking
│   │   └── (app)/
│   │       ├── dashboard/          # Admin dashboard
│   │       ├── users/              # User management UI
│   │       └── jobs/               # Job tracking UI
│   └── config/
│       └── providers.json          # AI provider configs
├── scripts/
│   └── migrate-to-mongodb.js       # JSON to MongoDB migration
├── .env                            # Environment variables (create this)
├── .env.example                    # Example env file
├── package.json
├── vite.config.ts
├── README.md                       # API documentation
├── DATABASE.md                     # Database documentation
└── INSTALL.md                      # This file
```

---

## 🎯 Quick Start Commands

```bash
# Clone and setup
git clone https://github.com/amitchaulagain/corpus-rag.git
cd corpus-rag
npm install

# Configure
cp .env.example .env
nano .env  # Add your API keys

# Run
npm run dev

# Open browser
# http://localhost:3000
```

---

## 🔐 Security Checklist

Before deploying to production:

- [ ] Change MongoDB to use authentication (see DATABASE.md)
- [ ] Update `.env` with production URLs
- [ ] Enable HTTPS for production domain
- [ ] Add production domain to Google OAuth authorized origins
- [ ] Rotate all API keys regularly
- [ ] Set up MongoDB backups
- [ ] Enable MongoDB audit logging
- [ ] Configure firewall rules
- [ ] Set up monitoring (PM2, Docker, etc.)

---

## 📚 Next Steps

After installation:

1. **Read API Documentation**: See [README.md](./README.md)
2. **Understand Database**: See [DATABASE.md](./DATABASE.md)
3. **Test API Endpoints**: Use Postman or curl
4. **Build Automation Bot**: Integrate with your Seek/LinkedIn bot
5. **Monitor Usage**: Check `/jobs` page in admin UI

---

## 🆘 Getting Help

### Logs

```bash
# Application logs (in dev mode, shown in terminal)
npm run dev

# MongoDB logs
sudo journalctl -u mongod -f

# System logs
tail -f /var/log/syslog | grep mongo
```

### Debug Mode

```bash
# Run with debug output
DEBUG=* npm run dev
```

### Common Issues

1. **"Cannot connect to MongoDB"** → Check `systemctl status mongod`
2. **"OAuth error"** → Verify Google Console settings
3. **"API key invalid"** → Check `.env` file has correct keys
4. **"Port in use"** → Change port in `vite.config.ts`

---

## 📞 Support

- GitHub Issues: https://github.com/amitchaulagain/corpus-rag/issues
- MongoDB Docs: https://www.mongodb.com/docs/
- SvelteKit Docs: https://kit.svelte.dev/docs

---

## ✅ Installation Checklist

- [ ] Node.js v18+ installed
- [ ] MongoDB v7.0+ installed and running
- [ ] Repository cloned
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file created with all required keys
- [ ] Google OAuth client configured
- [ ] MongoDB database initialized
- [ ] Application starts without errors
- [ ] Can login with Google OAuth
- [ ] Dashboard loads successfully
- [ ] API endpoints responding

**Congratulations! Your Corpus RAG installation is complete! 🎉**
