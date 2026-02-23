# References/Citations Implementation Plan

## Overview
Add references/citations to show where answers came from (generic questions, resume, job description) in the AI Recommendation section.

## Current State

### Knowledge Base Sources
1. **Resume/Documents**: User-uploaded files from `./data/uploads/{email}/`
2. **Generic Questions**: User's generic Q&A pairs from MongoDB
3. **Job Description**: Optional job posting details

### Current Flow
1. User clicks "Compare AI Answers"
2. System combines: Resume + Generic Questions + Job Description
3. Sends to AI providers
4. AI returns answers (JSON array)
5. Answers displayed without showing sources

## Implementation Plan

### Phase 1: Enhanced Prompt with Citation Instructions

**Goal**: Modify prompt to ask AI to cite sources

**Changes in `multi-provider-service.ts`**:
```typescript
private buildPrompt(documentsText: string, question: string): string {
  return `You are a helpful AI assistant. Answer the question based on the following documents and knowledge base.

DOCUMENTS & KNOWLEDGE BASE:
${documentsText}

QUESTION: ${question}

Please provide a clear and concise answer based on the information in the documents and knowledge base.

IMPORTANT: For each answer, indicate the source:
- If from generic questions knowledge base, mention "Generic Question: [keywords]"
- If from resume/documents, mention "Resume: [relevant section]"
- If from job description, mention "Job Description: [relevant part]"

If the documents don't contain enough information to answer the question, say so.`;
}
```

**Alternative Approach**: Use structured output format
```typescript
// Request structured response with citations
Return format:
{
  "answer": "your answer here",
  "sources": [
    {
      "type": "generic_question" | "resume" | "job_description",
      "reference": "specific reference text",
      "match_keywords": ["keyword1", "keyword2"] // for generic questions
    }
  ]
}
```

### Phase 2: Track Source Mapping

**Goal**: Map answers to their sources

**Approach 1: Post-Processing Analysis**
- After AI returns answer, analyze which source it likely came from
- Match answer text against generic questions
- Check if answer appears in resume
- Check if answer relates to job description

**Approach 2: Enhanced Prompt with Structured Output**
- Ask AI to return structured format with citations
- Parse structured response
- Extract sources directly from AI response

**Approach 3: Hybrid Approach** (Recommended)
- Use enhanced prompt asking for citations
- Parse AI response for citation markers
- Fallback to post-processing if citations not found
- Match against generic questions database

### Phase 3: Data Structure for References

**New Interface**:
```typescript
interface AnswerWithReferences {
  answer: string | number | number[]; // The actual answer
  sources: AnswerSource[];
}

interface AnswerSource {
  type: 'generic_question' | 'resume' | 'job_description' | 'ai_inference';
  reference: string; // Human-readable reference
  matchDetails?: {
    genericQuestionId?: string;
    keywords?: string[];
    matchedKeywords?: string[];
    confidence?: number;
  };
  excerpt?: string; // Relevant excerpt from source
}
```

**Store Structure**:
```typescript
// In employer-questions-store.ts
interface ParsedAnswer {
  answer: string | number | number[];
  sources?: AnswerSource[];
}
```

### Phase 4: Source Matching Logic

**Function: `findAnswerSources(questionText, answer, genericQuestions, resumeText, jobDescription)`**

**Logic**:
1. **Check Generic Questions**:
   - For each generic question, check if question text matches keywords
   - Check if answer matches any of the generic question's answers
   - Calculate match confidence score
   - Return best match(es)

2. **Check Resume**:
   - Search resume text for answer-related content
   - Extract relevant sections
   - Return excerpt if found

3. **Check Job Description**:
   - Search job description for relevant information
   - Return excerpt if found

4. **AI Inference**:
   - If no direct match, mark as "AI inference based on context"

### Phase 5: Enhanced Parsing

**Update `parseAIAnswers()` function**:
```typescript
function parseAIAnswers(aiResponse: string, questionTexts: string[], genericQuestions: GenericQuestion[], resumeText: string, jobDescription: string): AnswerWithReferences[] {
  // Parse JSON array from AI response
  const answers = extractJSONArray(aiResponse);
  
  // For each answer, find sources
  return answers.map((answer, index) => {
    const questionText = questionTexts[index];
    const sources = findAnswerSources(
      questionText,
      answer,
      genericQuestions,
      resumeText,
      jobDescription
    );
    
    return {
      answer,
      sources
    };
  });
}
```

### Phase 6: UI Display Updates

**Update AI Recommendation Section**:
```svelte
<!-- Show AI Recommendation with References -->
{#if parsedAnswers.length > index}
  {@const answerData = parsedAnswers[index]}
  {@const answer = typeof answerData === 'object' && answerData.answer ? answerData.answer : answerData}
  {@const sources = typeof answerData === 'object' && answerData.sources ? answerData.sources : []}
  
  <div style="margin-bottom: 1rem; padding: 1rem; background: rgba(0, 128, 128, 0.1); border-left: 4px solid teal; border-radius: 4px;">
    <p style="margin: 0 0 0.5rem 0; font-weight: 600; color: teal;">🤖 AI Recommendation:</p>
    
    <!-- Answer -->
    {#if question.type === 'text'}
      <p style="margin: 0 0 0.75rem 0; font-size: 0.95rem;">{answer}</p>
    {:else if Array.isArray(answer)}
      <p style="margin: 0 0 0.75rem 0; font-size: 0.95rem;">
        <strong>Options:</strong> [{answer.join(', ')}] 
        ({answer.map(i => question.opts && question.opts[i] ? question.opts[i] : `Option ${i}`).join(', ')})
      </p>
    {:else}
      <p style="margin: 0 0 0.75rem 0; font-size: 0.95rem;">
        <strong>Option:</strong> {answer} 
        ({question.opts && question.opts[answer] ? question.opts[answer] : `Option ${answer}`})
      </p>
    {/if}
    
    <!-- References Section -->
    {#if sources && sources.length > 0}
      <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(0, 128, 128, 0.2);">
        <p style="margin: 0 0 0.5rem 0; font-weight: 600; font-size: 0.85rem; color: rgba(0, 128, 128, 0.8);">📚 Sources:</p>
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          {#each sources as source}
            <div style="padding: 0.5rem; background: rgba(0, 128, 128, 0.05); border-radius: 4px; font-size: 0.85rem;">
              {#if source.type === 'generic_question'}
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                  <span style="font-weight: 600;">📝 Generic Question:</span>
                  <span style="color: rgba(0, 128, 128, 0.8);">{source.reference}</span>
                </div>
                {#if source.matchDetails?.matchedKeywords}
                  <div style="font-size: 0.75rem; color: rgba(0, 0, 0, 0.6); margin-left: 1rem;">
                    Matched keywords: {source.matchDetails.matchedKeywords.join(', ')}
                  </div>
                {/if}
              {:else if source.type === 'resume'}
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-weight: 600;">📄 Resume:</span>
                  <span style="color: rgba(0, 128, 128, 0.8);">{source.reference}</span>
                </div>
                {#if source.excerpt}
                  <div style="font-size: 0.75rem; color: rgba(0, 0, 0, 0.6); margin-left: 1rem; margin-top: 0.25rem; font-style: italic;">
                    "{source.excerpt}"
                  </div>
                {/if}
              {:else if source.type === 'job_description'}
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-weight: 600;">💼 Job Description:</span>
                  <span style="color: rgba(0, 128, 128, 0.8);">{source.reference}</span>
                </div>
              {:else}
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-weight: 600;">🤖 AI Inference:</span>
                  <span style="color: rgba(0, 128, 128, 0.8);">{source.reference}</span>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}
```

### Phase 7: Source Matching Algorithm

**Function: `findAnswerSources()`**

```typescript
function findAnswerSources(
  questionText: string,
  answer: string | number | number[],
  genericQuestions: GenericQuestion[],
  resumeText: string,
  jobDescription: string | null
): AnswerSource[] {
  const sources: AnswerSource[] = [];
  
  // 1. Check Generic Questions
  const answerText = Array.isArray(answer) 
    ? answer.map(i => `option ${i}`).join(', ')
    : typeof answer === 'number' 
      ? `option ${answer}` 
      : answer.toString().toLowerCase();
  
  for (const gq of genericQuestions) {
    // Check if question matches keywords
    const keywordMatch = gq.match_keywords.some(keyword => 
      questionText.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // Check if answer matches
    const answerMatch = gq.answers.some(gqAnswer => 
      answerText.includes(gqAnswer.toLowerCase()) || 
      gqAnswer.toLowerCase().includes(answerText)
    );
    
    if (keywordMatch && answerMatch) {
      const matchedKeywords = gq.match_keywords.filter(k => 
        questionText.toLowerCase().includes(k.toLowerCase())
      );
      
      sources.push({
        type: 'generic_question',
        reference: `Keywords: ${gq.match_keywords.join(', ')}`,
        matchDetails: {
          genericQuestionId: gq._id?.toString(),
          keywords: gq.match_keywords,
          matchedKeywords,
          confidence: calculateConfidence(keywordMatch, answerMatch)
        }
      });
    }
  }
  
  // 2. Check Resume (for text answers)
  if (typeof answer === 'string' && resumeText) {
    const resumeMatch = findInResume(answer, resumeText);
    if (resumeMatch) {
      sources.push({
        type: 'resume',
        reference: resumeMatch.section,
        excerpt: resumeMatch.excerpt
      });
    }
  }
  
  // 3. Check Job Description
  if (jobDescription && typeof answer === 'string') {
    const jobMatch = findInJobDescription(answer, jobDescription);
    if (jobMatch) {
      sources.push({
        type: 'job_description',
        reference: jobMatch.section,
        excerpt: jobMatch.excerpt
      });
    }
  }
  
  // 4. If no sources found, mark as AI inference
  if (sources.length === 0) {
    sources.push({
      type: 'ai_inference',
      reference: 'Answer inferred from overall context and knowledge base'
    });
  }
  
  return sources;
}

function findInResume(answerText: string, resumeText: string): { section: string; excerpt: string } | null {
  // Simple search for answer-related content
  const lowerAnswer = answerText.toLowerCase();
  const lowerResume = resumeText.toLowerCase();
  
  if (lowerResume.includes(lowerAnswer)) {
    // Find context around match
    const index = lowerResume.indexOf(lowerAnswer);
    const start = Math.max(0, index - 50);
    const end = Math.min(resumeText.length, index + answerText.length + 50);
    const excerpt = resumeText.substring(start, end).trim();
    
    // Try to identify section
    const lines = resumeText.substring(0, index).split('\n');
    const section = lines[lines.length - 1].trim() || 'Resume';
    
    return { section, excerpt };
  }
  
  return null;
}

function findInJobDescription(answerText: string, jobDesc: string): { section: string; excerpt: string } | null {
  const lowerAnswer = answerText.toLowerCase();
  const lowerJobDesc = jobDesc.toLowerCase();
  
  if (lowerJobDesc.includes(lowerAnswer)) {
    const index = lowerJobDesc.indexOf(lowerAnswer);
    const start = Math.max(0, index - 50);
    const end = Math.min(jobDesc.length, index + answerText.length + 50);
    const excerpt = jobDesc.substring(start, end).trim();
    
    return { section: 'Job Description', excerpt };
  }
  
  return null;
}

function calculateConfidence(keywordMatch: boolean, answerMatch: boolean): number {
  if (keywordMatch && answerMatch) return 0.9;
  if (keywordMatch || answerMatch) return 0.6;
  return 0.3;
}
```

### Phase 8: Store Updates

**Update `employer-questions-store.ts`**:
```typescript
interface EmployerQuestionsState {
  // ... existing fields
  parsedAnswers: AnswerWithReferences[]; // Updated type
  answerReferences: AnswerSource[][]; // Per-question references
}

// Update setParsedAnswers to accept references
setParsedAnswers: (parsed: AnswerWithReferences[]) => {
  update(state => ({
    ...state,
    parsedAnswers: parsed,
    answerReferences: parsed.map(a => a.sources || [])
  }));
}
```

### Phase 9: API Response Enhancement

**Update `/api/employer-questions/compare` endpoint**:
- Include generic questions in response metadata
- Include resume text length/availability
- Include job description availability
- This helps frontend match sources

### Phase 10: UI Enhancements

**Additional Features**:
1. **Expandable References**: Click to see full excerpt
2. **Source Icons**: Different icons for each source type
3. **Confidence Indicators**: Show confidence level for matches
4. **Copy Reference**: Copy source text to clipboard
5. **View Generic Question**: Link to generic questions page

## Implementation Steps

### Step 1: Update Data Structures (30 min)
- Add `AnswerWithReferences` interface
- Update store to handle references
- Update parsing function signature

### Step 2: Implement Source Matching (2 hours)
- Create `findAnswerSources()` function
- Implement generic question matching
- Implement resume matching
- Implement job description matching
- Add confidence scoring

### Step 3: Update Parsing Logic (1 hour)
- Modify `parseAIAnswers()` to include source finding
- Pass required data (generic questions, resume, job description)
- Return structured data with references

### Step 4: Update UI Display (1.5 hours)
- Modify AI Recommendation section
- Add references display
- Add expandable sections
- Style references section

### Step 5: Enhance Prompt (30 min)
- Update prompt to request citations
- Test with AI providers
- Handle cases where AI doesn't provide citations

### Step 6: Testing & Refinement (1 hour)
- Test with various question types
- Test with/without generic questions
- Test with/without resume
- Verify references are accurate
- Refine matching algorithm

## Data Flow

```
User clicks "Compare AI Answers"
    ↓
System retrieves:
  - Resume text
  - Generic questions
  - Job description
    ↓
Send to AI with enhanced prompt
    ↓
AI returns answers
    ↓
Parse answers (extract JSON array)
    ↓
For each answer:
  - Match against generic questions
  - Search in resume
  - Search in job description
  - Calculate confidence
    ↓
Store answers with references
    ↓
Display in UI with source citations
```

## UI Mockup

```
🤖 AI Recommendation:
Answer: Option 1 (Yes)

📚 Sources:
  📝 Generic Question: Keywords: right to work, work authorization
     Matched keywords: right to work
  
  📄 Resume: Experience Section
     "I have a graduate temporary work visa..."
```

## Success Criteria

✅ References displayed for each answer
✅ Generic question matches shown with keywords
✅ Resume excerpts shown when applicable
✅ Job description references shown when applicable
✅ Confidence indicators displayed
✅ Expandable sections for detailed view
✅ References help user understand answer source
✅ Works with all question types (text, select, checkbox)

## Estimated Time
**Total**: ~6 hours

## Notes
- Consider caching source matches for performance
- May want to highlight matched keywords in question text
- Could add "View Source" button to see full generic question
- Consider adding "Edit Generic Question" link from references
- May want to show multiple sources if answer matches multiple generic questions
