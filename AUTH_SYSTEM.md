# Authentication & User Management System

## Overview

MongoDB-based user management with Google OAuth, session tokens, and per-user API permissions.

## Database Schema

### Collections

#### `users`
```javascript
{
  _id: ObjectId,
  email: String (unique),
  googleId: String (unique),
  name: String,
  picture: String,
  userType: 'admin' | 'premium' | 'freetier',
  isPaid: Boolean,
  apiPermissions: {
    cover_letter: Boolean,
    resume: Boolean,
    questionAndAnswers: Boolean,
    upload: Boolean,
    jobs: Boolean
  },
  createdAt: Date,
  lastLogin: Date
}
```

#### `sessions`
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  token: String (unique),
  expiresAt: Date,
  createdAt: Date
}
```

## User Types & Default Permissions

### Admin
- All permissions enabled
- Can manage other users
- **Default permissions:** All APIs enabled

### Premium (isPaid: true)
- All standard features
- **Default permissions:** All APIs enabled

### Freetier (isPaid: false)
- Limited access
- **Default permissions:**
  - ✅ cover_letter
  - ❌ resume
  - ❌ questionAndAnswers
  - ✅ upload
  - ✅ jobs

## API Endpoints

### Auth Endpoints

#### `POST /api/auth/login`
**Description:** Login with Google OAuth

**Request:**
```json
{
  "credential": "google_id_token"
}
```

**Response:**
```json
{
  "success": true,
  "token": "session_token_here",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "User Name",
    "picture": "https://...",
    "userType": "freetier",
    "isPaid": false,
    "apiPermissions": { ... }
  }
}
```

#### `POST /api/auth/logout`
**Description:** Logout and invalidate session

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### `GET /api/auth/verify`
**Description:** Verify session token and get user info

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "user": { ... }
}
```

### Admin Endpoints

#### `GET /api/admin/users`
**Description:** List all users (admin only)

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "users": [...]
}
```

#### `PUT /api/admin/users`
**Description:** Update user type/permissions (admin only)

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Request:**
```json
{
  "userId": "user_id",
  "userType": "premium",
  "isPaid": true,
  "apiPermissions": {
    "cover_letter": true,
    "resume": true,
    "questionAndAnswers": true,
    "upload": true,
    "jobs": true
  }
}
```

#### `DELETE /api/admin/users`
**Description:** Delete user (admin only)

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Request:**
```json
{
  "userId": "user_id"
}
```

### Protected API Endpoints

All these endpoints now require authentication and check permissions:

- `POST /api/cover_letter` - Requires `cover_letter` permission
- `POST /api/resume` - Requires `resume` permission
- `POST /api/questionAndAnswers` - Requires `questionAndAnswers` permission

**Headers required:**
```
Authorization: Bearer <token>
```

**Error responses:**
- `401` - Authentication required / Invalid token
- `403` - Permission denied

## Setup

1. **Install MongoDB:**
```bash
sudo apt install mongodb-community
# OR with Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

2. **Start MongoDB:**
```bash
sudo systemctl start mongod
# OR with Docker
docker start mongodb
```

3. **Environment Variables:**
Already added to `.env`:
```
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=corpus_rag
```

4. **Run the app:**
```bash
npm run dev
```

Database connection and indexes are created automatically on first run.

## Usage Flow

1. **User logs in with Google:**
   - Frontend gets Google ID token
   - Calls `POST /api/auth/login` with token
   - Receives session token
   - New users auto-created as `freetier`

2. **User makes API calls:**
   - Include `Authorization: Bearer <token>` header
   - Backend checks auth + permissions
   - Returns data or 401/403 error

3. **Admin manages users:**
   - Admin calls `GET /api/admin/users` to list
   - Admin calls `PUT /api/admin/users` to upgrade user to premium
   - Admin calls `PUT /api/admin/users` to enable/disable specific APIs per user

## Creating First Admin User

After first login, manually update user in MongoDB:

```javascript
db.users.updateOne(
  { email: "your@email.com" },
  { $set: { userType: "admin", isPaid: true } }
)
```

Or use MongoDB Compass / mongosh CLI.

## Security Features

- ✅ Google OAuth verification
- ✅ Session token-based auth
- ✅ Per-user API permissions
- ✅ Admin-only user management
- ✅ TTL index for auto-expiring sessions
- ✅ Token-based authentication (no passwords stored)

## Models

- **UserModel**: `src/lib/models/user.ts`
- **SessionModel**: `src/lib/models/session.ts`
- **DB Connection**: `src/lib/db.ts`
- **Auth Middleware**: `src/lib/auth-middleware.ts`
