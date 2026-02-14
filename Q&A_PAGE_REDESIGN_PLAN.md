# Q&A Page Redesign Implementation Plan

## Overview
Redesign the Employer Questions page to show:
1. **Raw JSON data** for questions and options (for analysis)
2. **Raw JSON response** when compare button is clicked (for debugging)
3. **Easy-to-read Q&A format** showing parsed answers clearly (for verification)

## Current State Analysis

### Current Data Structure
- Questions are stored in `jobContent.questions` array
- Each question has: `id`, `q`, `type`, `opts[]`, `containerSelector`
- Comparison results come from API as streaming JSON
- Parsed answers are stored in `parsedAnswers` array

### Current UI Flow
1. User selects job → loads `jobContent`
2. User clicks "Compare AI Answers" → streams results from API
3. Results displayed in cards with formatted text
4. Questions shown with highlighted recommended options

## Implementation Plan

### Phase 1: Add View Toggle System
**Goal**: Allow users to switch between different views

**Components to Add**:
- View toggle buttons: `Raw Data` | `API Response` | `Easy Read`
- State management for current view mode
- Conditional rendering based on selected view

**Implementation**:
```typescript
let viewMode: 'raw' | 'api' | 'readable' = 'readable';
```

### Phase 2: Raw Data Display Section
**Goal**: Show raw JSON structure of questions and options

**Location**: Above or alongside the questions list

**Display Format**:
```json
{
  "questions": [
    {
      "id": 0,
      "q": "How many years of work experience do you have with Python?",
      "type": "text",
      "opts": []
    },
    {
      "id": 1,
      "q": "Yes",
      "type": "radio",
      "opts": ["Yes", "No"]
    }
  ]
}
```

**Features**:
- Collapsible/expandable section
- Syntax-highlighted JSON
- Copy to clipboard button
- Pretty-printed format

### Phase 3: Raw API Response Display
**Goal**: Show complete raw JSON response from compare API

**Trigger**: When compare button is clicked and results arrive

**Display Format**:
```json
{
  "provider-claude-sonnet-4": {
    "success": true,
    "text": "[3, [1,4], 2]",
    "metadata": {
      "model": "claude-sonnet-4",
      "processingTime": 2.3,
      "tokensUsed": 1500,
      "cost": {...}
    }
  },
  "provider-deepseek-chat": {
    "success": true,
    "text": "[3, [1,4], 2]",
    ...
  }
}
```

**Features**:
- Show full comparison results object
- Syntax-highlighted JSON
- Copy to clipboard button
- Expandable per-provider sections
- Show raw text response before parsing

### Phase 4: Easy-to-Read Q&A Format
**Goal**: Display parsed answers in a clear, readable format

**Display Format**:
```
📋 Q&A Summary for [Company Name] - [Job Title]

Question 1: How many years of work experience do you have with Python?
Type: text
AI Recommendation: "5+ years"
Provider: Claude Sonnet 4

Question 2: Are you comfortable working in the office 5 days a week?
Type: select
Options:
  0: Select an option
  1: Yes ✅ [AI PICK]
  2: No
AI Recommendation: Option 1 (Yes)
Provider: Claude Sonnet 4

Question 3: Which technologies do you have experience with?
Type: checkbox
Options:
  0: React ✅ [AI PICK]
  1: Vue.js
  2: Angular ✅ [AI PICK]
  3: Svelte
AI Recommendation: Options [0, 2] (React, Angular)
Provider: Claude Sonnet 4
```

**Features**:
- Clear question numbering
- Question text displayed prominently
- Question type clearly labeled
- All options listed with indices
- Recommended options highlighted
- Shows which provider's answer is being used
- For text questions, shows the actual text response
- For select/checkbox, shows option indices and values

### Phase 5: Enhanced Parsing & Validation
**Goal**: Ensure answers are correctly parsed and displayed

**Validation Checks**:
- Verify parsed array length matches question count
- Validate option indices are within bounds
- Handle parsing errors gracefully
- Show warnings for mismatched data

**Error Handling**:
- Display parsing errors clearly
- Show raw response when parsing fails
- Allow manual correction/adjustment

### Phase 6: UI/UX Improvements

**Layout Structure**:
```
┌─────────────────────────────────────────┐
│ [View Toggle: Raw | API | Easy Read]   │
├─────────────────────────────────────────┤
│                                         │
│  [Selected View Content]                │
│                                         │
└─────────────────────────────────────────┘
```

**Features**:
- Sticky header with view toggles
- Smooth transitions between views
- Preserve scroll position when switching
- Auto-scroll to relevant sections
- Keyboard shortcuts for view switching

### Phase 7: Testing Strategy

**Test Cases**:

1. **Raw Data View**
   - ✅ Verify all questions are displayed in JSON format
   - ✅ Verify options array is correctly shown
   - ✅ Test copy to clipboard functionality
   - ✅ Test with jobs having different question types

2. **API Response View**
   - ✅ Verify complete response object is shown
   - ✅ Verify all providers' responses are displayed
   - ✅ Test with streaming responses (show as they arrive)
   - ✅ Test with error responses
   - ✅ Verify metadata is included

3. **Easy Read View**
   - ✅ Verify questions are numbered correctly
   - ✅ Verify question types are shown
   - ✅ Verify options are listed with correct indices
   - ✅ Verify recommended options are highlighted
   - ✅ Test with text questions (show actual text)
   - ✅ Test with select questions (show single option)
   - ✅ Test with checkbox questions (show multiple options)
   - ✅ Verify provider name is shown

4. **Parsing Validation**
   - ✅ Test with valid JSON array: `[3, [1,4], 2]`
   - ✅ Test with text responses: `"5+ years"`
   - ✅ Test with malformed responses
   - ✅ Test with responses that don't match question count
   - ✅ Test with out-of-bounds option indices

5. **Edge Cases**
   - ✅ Job with no questions
   - ✅ Job with only text questions
   - ✅ Job with only select/checkbox questions
   - ✅ Job with mixed question types
   - ✅ Comparison with no successful results
   - ✅ Comparison with partial failures

## File Changes Required

### 1. `/corpus-rag/src/routes/(app)/employer-questions/+page.svelte`
**Changes**:
- Add view mode state management
- Add view toggle buttons
- Add raw data display section
- Add API response display section
- Enhance easy-read display format
- Add JSON syntax highlighting (or use `<pre>` with formatting)
- Add copy-to-clipboard functions

### 2. `/corpus-rag/src/lib/employer-questions-store.ts`
**Changes**:
- Add method to store raw API response
- Add method to get formatted display data

### 3. New Component (Optional)
**File**: `/corpus-rag/src/lib/components/JsonViewer.svelte`
**Purpose**: Reusable JSON display component with syntax highlighting

## Implementation Steps

### Step 1: Add View Toggle System (30 min)
- Add `viewMode` state variable
- Create toggle buttons UI
- Add click handlers

### Step 2: Implement Raw Data View (45 min)
- Create raw JSON display section
- Format `jobContent.questions` as JSON
- Add copy button
- Style with monospace font

### Step 3: Implement API Response View (45 min)
- Capture full comparison results object
- Display as formatted JSON
- Add expandable sections per provider
- Show raw text before parsing

### Step 4: Enhance Easy Read View (60 min)
- Redesign question display format
- Add clear labeling for question types
- Show all options with indices
- Highlight recommended options
- Show provider information
- Handle text vs select vs checkbox differently

### Step 5: Add Parsing Validation (30 min)
- Add validation checks
- Display warnings for errors
- Show helpful error messages

### Step 6: Testing & Refinement (60 min)
- Test with multiple job examples
- Verify all question types work
- Test edge cases
- Refine UI/UX based on testing

## Success Criteria

✅ **Raw Data View**:
- All questions and options visible in JSON format
- Copy functionality works
- Formatting is readable

✅ **API Response View**:
- Complete response object displayed
- All providers shown
- Raw text visible before parsing
- Metadata included

✅ **Easy Read View**:
- Questions clearly numbered and formatted
- Question types clearly labeled
- Options listed with indices
- Recommended options highlighted
- Provider information shown
- Text responses displayed clearly

✅ **Overall**:
- Smooth transitions between views
- No data loss when switching views
- All question types handled correctly
- Parsing errors handled gracefully
- UI is intuitive and easy to use

## Estimated Time
**Total**: ~4.5 hours

## Notes
- Consider using a JSON syntax highlighting library (e.g., `highlight.js` or `prism.js`)
- May want to add export functionality (download as JSON/text)
- Consider adding search/filter within questions
- Consider adding comparison between providers' answers
