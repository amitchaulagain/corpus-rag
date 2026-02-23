# Generic Questions Integration Plan

## Overview
Integrate generic questions from finalboss into corpus-rag backend, and use them as part of the knowledge base when answering employer questions.

## Current State

### Finalboss Generic Questions
- **Location**: `finalboss/src/bots/seek/config/generic_questions_config.json`
- **Structure**:
  ```json
  {
    "lastUpdated": "2026-02-08T11:28:55.928Z",
    "questions": [
      {
        "id": 1,
        "match_keywords": ["right to work in Australia"],
        "answer": ["I have a graduate temporary work visa"]
      }
    ],
    "settings": {
      "autoAnswer": false
    }
  }
  ```
- **API**: `/api/generic-questions` (GET, POST, PUT, DELETE)
- **Storage**: Local JSON file

### Corpus-Rag Current Knowledge Base
- **Location**: `./data/uploads/{userEmail}/`
- **Content**: User-uploaded documents (resume, cover letters, etc.)
- **Usage**: Retrieved via `getAllUserDocuments(userId)` in `multi-provider-service.ts`

## Implementation Plan

### Phase 1: Database Schema Design

#### Create `generic_questions` Collection
**Purpose**: Store user-specific generic questions and answers

**Schema**:
```typescript
interface GenericQuestion {
  _id: ObjectId;
  userId: ObjectId;                    // Reference to users collection
  questionId: number;                  // Original ID from finalboss (for migration)
  match_keywords: string[];            // Keywords to match questions
  answers: string[];                   // Possible answers
  isActive: boolean;                   // Enable/disable this question
  createdAt: Date;
  updatedAt: Date;
}

interface GenericQuestionsSettings {
  _id: ObjectId;
  userId: ObjectId;                    // Reference to users collection
  autoAnswer: boolean;                  // Enable/disable auto-answering
  lastUpdated: Date;
}
```

**Alternative Approach** (Embedded in User):
```typescript
// Add to User interface
interface User {
  // ... existing fields
  genericQuestions?: {
    questions: GenericQuestion[];
    settings: {
      autoAnswer: boolean;
      lastUpdated: Date;
    };
  };
}
```

**Recommendation**: Use separate collection for better scalability and easier querying.

### Phase 2: API Endpoints in Corpus-Rag

#### 1. GET `/api/generic-questions`
**Purpose**: Get all generic questions for authenticated user

**Response**:
```json
{
  "success": true,
  "data": {
    "questions": [
      {
        "_id": "...",
        "questionId": 1,
        "match_keywords": ["right to work"],
        "answers": ["Australian citizen"],
        "isActive": true
      }
    ],
    "settings": {
      "autoAnswer": true,
      "lastUpdated": "2026-02-01T..."
    }
  }
}
```

#### 2. POST `/api/generic-questions`
**Purpose**: Create a new generic question

**Request**:
```json
{
  "match_keywords": ["visa status"],
  "answers": ["I have work rights"]
}
```

#### 3. PUT `/api/generic-questions/:questionId`
**Purpose**: Update an existing question

**Request**:
```json
{
  "match_keywords": ["updated keywords"],
  "answers": ["updated answers"],
  "isActive": true
}
```

#### 4. DELETE `/api/generic-questions/:questionId`
**Purpose**: Delete a question

#### 5. PUT `/api/generic-questions/settings`
**Purpose**: Update settings

**Request**:
```json
{
  "autoAnswer": true
}
```

### Phase 3: Database Model

**File**: `corpus-rag/src/lib/models/generic-questions.ts`

```typescript
import { ObjectId, Db } from 'mongodb';
import { getDB } from '../db/mongodb';

export interface GenericQuestion {
  _id?: ObjectId;
  userId: ObjectId;
  questionId?: number;              // For migration from finalboss
  match_keywords: string[];
  answers: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GenericQuestionsSettings {
  _id?: ObjectId;
  userId: ObjectId;
  autoAnswer: boolean;
  lastUpdated: Date;
}

export class GenericQuestionsModel {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async getQuestionsByUserId(userId: ObjectId): Promise<GenericQuestion[]> {
    return await this.db
      .collection<GenericQuestion>('generic_questions')
      .find({ userId, isActive: true })
      .toArray();
  }

  async createQuestion(question: Omit<GenericQuestion, '_id' | 'createdAt' | 'updatedAt'>): Promise<ObjectId> {
    const now = new Date();
    const result = await this.db
      .collection<GenericQuestion>('generic_questions')
      .insertOne({
        ...question,
        createdAt: now,
        updatedAt: now
      });
    return result.insertedId;
  }

  async updateQuestion(questionId: ObjectId, updates: Partial<GenericQuestion>): Promise<boolean> {
    const result = await this.db
      .collection<GenericQuestion>('generic_questions')
      .updateOne(
        { _id: questionId },
        { $set: { ...updates, updatedAt: new Date() } }
      );
    return result.modifiedCount > 0;
  }

  async deleteQuestion(questionId: ObjectId): Promise<boolean> {
    const result = await this.db
      .collection<GenericQuestion>('generic_questions')
      .deleteOne({ _id: questionId });
    return result.deletedCount > 0;
  }

  async getSettings(userId: ObjectId): Promise<GenericQuestionsSettings | null> {
    return await this.db
      .collection<GenericQuestionsSettings>('generic_questions_settings')
      .findOne({ userId });
  }

  async updateSettings(userId: ObjectId, settings: Partial<GenericQuestionsSettings>): Promise<void> {
    await this.db
      .collection<GenericQuestionsSettings>('generic_questions_settings')
      .updateOne(
        { userId },
        { 
          $set: { 
            ...settings, 
            userId,
            lastUpdated: new Date() 
          } 
        },
        { upsert: true }
      );
  }
}
```

### Phase 4: Integration with Knowledge Base

**File**: `corpus-rag/src/lib/multi-provider-service.ts`

**Modify `getAllUserDocuments` method**:
```typescript
private async getAllUserDocuments(userId: string): Promise<string> {
  try {
    // Get uploaded files
    const files = await this.storage.listFiles(userId);
    const fileContents = await Promise.all(
      files.map(filename => this.storage.getFileContent(userId, filename))
    );
    
    // Get generic questions
    const genericQuestionsText = await this.getGenericQuestionsText(userId);
    
    // Combine all sources
    const allContents = [
      ...fileContents,
      genericQuestionsText
    ].filter(Boolean); // Remove empty strings
    
    return allContents.join('\n\n---\n\n');
  } catch (error) {
    return '';
  }
}

private async getGenericQuestionsText(userId: string): Promise<string> {
  try {
    const db = await getDB();
    const genericQuestionsModel = new GenericQuestionsModel(db);
    
    // Get user ObjectId from email
    const userModel = new UserModel(db);
    const user = await userModel.findByEmail(userId);
    if (!user || !user._id) return '';
    
    const questions = await genericQuestionsModel.getQuestionsByUserId(user._id);
    
    if (questions.length === 0) return '';
    
    // Format as knowledge base text
    const formattedQuestions = questions.map((q, index) => {
      const keywords = q.match_keywords.join(', ');
      const answers = q.answers.join(' OR ');
      return `Q${index + 1}: For questions matching "${keywords}", use these answers: ${answers}`;
    }).join('\n\n');
    
    return `GENERIC QUESTIONS & ANSWERS:\n${formattedQuestions}`;
  } catch (error) {
    console.error('Failed to get generic questions:', error);
    return '';
  }
}
```

**Alternative**: Add to prompt building:
```typescript
private buildPrompt(documentsText: string, question: string, genericQuestionsText?: string): string {
  const genericSection = genericQuestionsText 
    ? `\n\nGENERIC QUESTIONS KNOWLEDGE BASE:\n${genericQuestionsText}\n`
    : '';
    
  return `You are a helpful AI assistant. Answer the question based on the following documents.

DOCUMENTS:
${documentsText}${genericSection}

QUESTION: ${question}

Please provide a clear and concise answer based on the information in the documents and generic questions knowledge base. If the documents don't contain enough information to answer the question, say so.`;
}
```

### Phase 5: Sync from Finalboss

**Option A: Manual Migration Script**
- Create script to read finalboss JSON file
- Map to corpus-rag schema
- Insert into MongoDB

**Option B: API Sync Endpoint**
- Create endpoint in corpus-rag: `POST /api/generic-questions/sync`
- Finalboss calls this endpoint when questions are updated
- Requires authentication

**Option C: Real-time Sync**
- Finalboss updates trigger webhook to corpus-rag
- Corpus-rag receives and stores updates

**Recommendation**: Start with Option A (migration script), then implement Option B for ongoing sync.

### Phase 6: Update Finalboss to Sync

**File**: `finalboss/src/routes/api/generic-questions/+server.js`

**Add sync call after save**:
```javascript
async function syncToCorpusRag(questionsData, userId) {
  try {
    const CORPUS_RAG_API = process.env.CORPUS_RAG_API || 'http://localhost:3000';
    const authToken = await getAuthToken(userId); // Get JWT token
    
    await fetch(`${CORPUS_RAG_API}/api/generic-questions/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        questions: questionsData.questions,
        settings: questionsData.settings
      })
    });
  } catch (error) {
    console.error('Failed to sync to corpus-rag:', error);
    // Don't fail the request, just log error
  }
}
```

### Phase 7: Frontend Updates

#### Update Corpus-Rag Generic Questions Page
**File**: `corpus-rag/src/routes/(app)/generic-questions/+page.svelte` (new)

- Create UI similar to finalboss generic questions page
- Connect to corpus-rag API endpoints
- Allow users to manage their generic questions

#### Update Finalboss Generic Questions Page
**File**: `finalboss/src/routes/generic-questions/+page.svelte`

- Add sync indicator
- Show sync status
- Optionally redirect to corpus-rag page

## Implementation Steps

### Step 1: Database Setup (30 min)
1. Create MongoDB model file: `generic-questions.ts`
2. Add collection indexes in `mongodb.ts`
3. Create migration script to initialize collections

### Step 2: API Endpoints (2 hours)
1. Create API route: `/api/generic-questions/+server.ts`
2. Implement CRUD operations
3. Add authentication middleware
4. Add validation

### Step 3: Knowledge Base Integration (1 hour)
1. Update `multi-provider-service.ts`
2. Add `getGenericQuestionsText` method
3. Integrate into prompt building
4. Test with sample questions

### Step 4: Sync Mechanism (1.5 hours)
1. Create sync endpoint: `/api/generic-questions/sync/+server.ts`
2. Create migration script from finalboss JSON
3. Update finalboss to call sync endpoint
4. Add error handling

### Step 5: Frontend (2 hours)
1. Create generic questions page in corpus-rag
2. Update finalboss page with sync indicator
3. Add loading states and error handling

### Step 6: Testing (1 hour)
1. Test CRUD operations
2. Test knowledge base integration
3. Test sync from finalboss
4. Verify answers use generic questions

## Database Indexes

```typescript
// In mongodb.ts createIndexes()
await db.collection('generic_questions').createIndex({ userId: 1, isActive: 1 });
await db.collection('generic_questions').createIndex({ userId: 1, questionId: 1 });
await db.collection('generic_questions_settings').createIndex({ userId: 1 }, { unique: true });
```

## API Authentication

All endpoints should use existing authentication middleware:
```typescript
import { requirePermission } from '$lib/auth-middleware';

export const GET: RequestHandler = async (event) => {
  const auth = await requirePermission(event, 'questionAndAnswers');
  // ... implementation
};
```

## Error Handling

- Validate match_keywords and answers arrays
- Ensure userId matches authenticated user
- Handle duplicate questionIds during sync
- Gracefully handle missing generic questions (fallback to resume only)

## Migration Strategy

1. **Initial Migration**: Run script to migrate existing finalboss questions
2. **User Mapping**: Map finalboss users to corpus-rag users by email
3. **Data Validation**: Verify all questions migrated correctly
4. **Testing**: Test with sample user accounts

## Success Criteria

✅ Generic questions stored in MongoDB per user
✅ API endpoints working for CRUD operations
✅ Generic questions included in knowledge base
✅ Answers reflect both resume and generic questions
✅ Sync from finalboss working
✅ Frontend UI functional
✅ No breaking changes to existing functionality

## Estimated Time
**Total**: ~8 hours

## Notes
- Consider adding versioning for generic questions
- May want to add question categories/tags
- Consider adding usage analytics (which questions are used most)
- Could add question templates for common scenarios
