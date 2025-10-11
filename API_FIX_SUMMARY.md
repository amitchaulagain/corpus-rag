# Job Analysis API Fix

## Issue
Job analysis page was showing error: **"Failed to generate analysis: API key required"**

## Root Cause
The `/api/generate` endpoint was trying to call a non-existent endpoint `/api/rag/query` instead of the correct `/api/query` endpoint.

## Changes Made

### File: `src/routes/api/generate/+server.ts`

**Before:**
```typescript
const ragResponse = await fetch(`${event.url.origin}/api/rag/query`, {
  method: 'POST',
  // ...
  body: JSON.stringify({
    userId: userEmail || auth.user?.email || 'anonymous',
    question: prompt,
    context: analysisContext,
    maxTokens: type === 'job_analysis' ? 16384 : 2000,
    temperature: 0.7
  })
});
```

**After:**
```typescript
const providerId = 'deepseek-chat'; // Use deepseek-chat as default provider

const ragResponse = await fetch(`${event.url.origin}/api/query`, {
  method: 'POST',
  // ...
  body: JSON.stringify({
    userId: userEmail || auth.user?.email || 'anonymous',
    question: analysisContext ? `${analysisContext}\n\n${prompt}` : prompt,
    providerId: providerId
  })
});
```

**Response handling updated:**
```typescript
// Before
const answer = ragResult.data ? ragResult.data.answer : ragResult.answer;

// After
const answer = ragResult.answer;
```

## API Keys Verified

✅ All required API keys are configured in `.env`:
- `CLAUDE_API_KEY` - Configured
- `DEEPSEEK_API_KEY` - Configured  
- `GEMINI_API_KEY` - Configured

## Provider Configuration

The default provider is set to **DeepSeek Chat** (`deepseek-chat`), which is:
- ✅ Enabled in `src/config/providers.json`
- ✅ Has API key configured
- ✅ Model: `deepseek-chat`

## Testing

To test the fix:
1. Navigate to the Job Analysis page
2. Select a job from the sidebar
3. Click "Generate Analysis"
4. The analysis should now generate successfully using the DeepSeek API

## Notes

- The fix uses DeepSeek as the default AI provider
- This can be made configurable in the future if needed
- The same fix applies to all generation types:
  - `job_analysis`
  - `cover_letter`
  - `employer_answers`
  - `resume_enhancement`
  - `resume_comparison`

## Date
October 11, 2025
