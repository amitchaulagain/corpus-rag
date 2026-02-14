// Source matching utilities for finding where answers came from
import type { GenericQuestion } from '$lib/models/generic-questions';
import type { AnswerSource } from '$lib/types/answer-references';

/**
 * Find sources for an answer by matching against generic questions, resume, and job description
 */
export function findAnswerSources(
  questionText: string,
  answer: string | number | number[],
  genericQuestions: GenericQuestion[],
  resumeText: string | null,
  jobDescription: string | null
): AnswerSource[] {
  const sources: AnswerSource[] = [];
  const lowerQuestionText = questionText.toLowerCase();
  
  // Convert answer to searchable text
  const answerText = Array.isArray(answer) 
    ? answer.map(i => `option ${i}`).join(', ')
    : typeof answer === 'number' 
      ? `option ${answer}` 
      : answer.toString().toLowerCase();
  
  // 1. Check Generic Questions
  for (const gq of genericQuestions) {
    if (gq.isActive === false) continue;
    const keywords = gq.match_keywords || [];
    const answers = gq.answers || [];
    
    // Check if question matches keywords
    const matchedKeywords = keywords.filter(keyword => 
      lowerQuestionText.includes(keyword.toLowerCase())
    );
    
    // Check if answer matches any of the generic question's answers
    const answerMatch = answers.some(gqAnswer => {
      const lowerGqAnswer = gqAnswer.toLowerCase();
      return answerText.includes(lowerGqAnswer) || 
             lowerGqAnswer.includes(answerText) ||
             // Also check if answer index matches
             (typeof answer === 'number' && lowerGqAnswer.includes(`option ${answer}`)) ||
             (Array.isArray(answer) && answer.some(idx => lowerGqAnswer.includes(`option ${idx}`)));
    });
    
    // If keywords match, consider it a source (even if answer doesn't match exactly)
    if (matchedKeywords.length > 0) {
      const confidence = calculateConfidence(matchedKeywords.length, keywords.length, answerMatch);
      const rawId = gq._id as unknown;
      const genericQuestionId = typeof rawId === 'string'
        ? rawId
        : (rawId as { $oid?: string })?.$oid ?? (rawId as { toString?: () => string })?.toString?.();
      
      sources.push({
        type: 'generic_question',
        reference: `Keywords: ${keywords.join(', ')}`,
        matchDetails: {
          genericQuestionId: genericQuestionId ? String(genericQuestionId) : undefined,
          keywords,
          matchedKeywords,
          confidence
        },
        excerpt: answers.join(' OR ')
      });
    }
  }
  
  // 2. Check Resume (for text answers or when answer might be in resume)
  if (resumeText && resumeText.trim().length > 0) {
    const resumeMatch = findInResume(questionText, answerText, resumeText);
    if (resumeMatch) {
      sources.push({
        type: 'resume',
        reference: resumeMatch.section,
        excerpt: resumeMatch.excerpt
      });
    }
  }
  
  // 3. Check Job Description
  if (jobDescription && jobDescription.trim().length > 0) {
    const jobMatch = findInJobDescription(questionText, answerText, jobDescription);
    if (jobMatch) {
      sources.push({
        type: 'job_description',
        reference: jobMatch.section,
        excerpt: jobMatch.excerpt
      });
    }
  }
  
  // 4. If no sources found, mark as AI inference and attach KB summary: show actual KB Q&A first, then context
  if (sources.length === 0) {
    const kbParts: string[] = [];
    const activeGq = genericQuestions.filter(gq => gq.isActive);
    if (activeGq.length > 0) {
      activeGq.slice(0, 12).forEach((gq, i) => {
        const keywords = (gq.match_keywords || []).join(', ');
        const answers = (gq.answers || []).join(' OR ');
        kbParts.push(`Q${i + 1} (match: ${keywords})`);
        kbParts.push(`A: ${answers}`);
      });
      if (activeGq.length > 12) kbParts.push(`… and ${activeGq.length - 12} more Q&A entries`);
    }
    const contextParts: string[] = [];
    if (resumeText && resumeText.trim().length > 0) {
      const slice = resumeText.trim().length > 200 ? resumeText.trim().slice(0, 200) + '…' : resumeText.trim();
      contextParts.push(`Resume (context): ${slice}`);
    }
    if (jobDescription && jobDescription.trim().length > 0) {
      const slice = jobDescription.trim().length > 200 ? jobDescription.trim().slice(0, 200) + '…' : jobDescription.trim();
      contextParts.push(`Job description (context): ${slice}`);
    }
    if (contextParts.length > 0) {
      kbParts.push('\n---\nAlso in context:');
      kbParts.push(contextParts.join('\n\n'));
    }
    const excerpt = kbParts.length > 0 ? kbParts.join('\n') : 'No documents in knowledge base.';
    sources.push({
      type: 'ai_inference',
      reference: 'Inferred from the knowledge base (Q&A and context below)',
      excerpt
    });
  }
  
  // Sort by confidence/type priority
  return sources.sort((a, b) => {
    // Generic questions with high confidence first
    if (a.type === 'generic_question' && a.matchDetails?.confidence) {
      if (b.type === 'generic_question' && b.matchDetails?.confidence) {
        return (b.matchDetails.confidence || 0) - (a.matchDetails.confidence || 0);
      }
      return -1;
    }
    if (b.type === 'generic_question' && b.matchDetails?.confidence) return 1;
    
    // Then resume, then job description, then AI inference
    const typeOrder = { generic_question: 0, rag_chunk: 1, resume: 2, job_description: 3, ai_inference: 4 };
    return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
  });
}

/**
 * Find relevant content in resume
 */
function findInResume(questionText: string, answerText: string, resumeText: string): { section: string; excerpt: string } | null {
  const lowerResume = resumeText.toLowerCase();
  const lowerAnswer = answerText.toLowerCase();
  const lowerQuestion = questionText.toLowerCase();
  
  // Try to find answer-related content
  if (lowerResume.includes(lowerAnswer) && lowerAnswer.length > 3) {
    const index = lowerResume.indexOf(lowerAnswer);
    const start = Math.max(0, index - 100);
    const end = Math.min(resumeText.length, index + answerText.length + 100);
    const excerpt = resumeText.substring(start, end).trim();
    
    // Try to identify section
    const beforeMatch = resumeText.substring(0, index);
    const lines = beforeMatch.split('\n').filter(l => l.trim().length > 0);
    const section = lines.length > 0 ? lines[lines.length - 1].substring(0, 50).trim() : 'Resume';
    
    return { section, excerpt };
  }
  
  // Try to find question-related keywords in resume
  const questionKeywords = questionText.split(/\s+/).filter(w => w.length > 4);
  for (const keyword of questionKeywords) {
    if (lowerResume.includes(keyword.toLowerCase())) {
      const index = lowerResume.indexOf(keyword.toLowerCase());
      const start = Math.max(0, index - 100);
      const end = Math.min(resumeText.length, index + keyword.length + 100);
      const excerpt = resumeText.substring(start, end).trim();
      
      return { section: 'Resume', excerpt };
    }
  }
  
  return null;
}

/**
 * Find relevant content in job description
 */
function findInJobDescription(questionText: string, answerText: string, jobDesc: string): { section: string; excerpt: string } | null {
  const lowerJobDesc = jobDesc.toLowerCase();
  const lowerAnswer = answerText.toLowerCase();
  const lowerQuestion = questionText.toLowerCase();
  
  // Try to find answer-related content
  if (lowerJobDesc.includes(lowerAnswer) && lowerAnswer.length > 3) {
    const index = lowerJobDesc.indexOf(lowerAnswer);
    const start = Math.max(0, index - 100);
    const end = Math.min(jobDesc.length, index + answerText.length + 100);
    const excerpt = jobDesc.substring(start, end).trim();
    
    return { section: 'Job Description', excerpt };
  }
  
  // Try to find question-related keywords
  const questionKeywords = questionText.split(/\s+/).filter(w => w.length > 4);
  for (const keyword of questionKeywords) {
    if (lowerJobDesc.includes(keyword.toLowerCase())) {
      const index = lowerJobDesc.indexOf(keyword.toLowerCase());
      const start = Math.max(0, index - 100);
      const end = Math.min(jobDesc.length, index + keyword.length + 100);
      const excerpt = jobDesc.substring(start, end).trim();
      
      return { section: 'Job Description', excerpt };
    }
  }
  
  return null;
}

/**
 * Calculate confidence score for a match
 */
function calculateConfidence(
  matchedKeywordsCount: number,
  totalKeywordsCount: number,
  answerMatch: boolean
): number {
  const keywordRatio = totalKeywordsCount > 0 ? matchedKeywordsCount / totalKeywordsCount : 0;
  
  if (keywordRatio >= 0.8 && answerMatch) return 0.95;
  if (keywordRatio >= 0.5 && answerMatch) return 0.85;
  if (keywordRatio >= 0.8) return 0.75;
  if (keywordRatio >= 0.5) return 0.65;
  if (answerMatch) return 0.7;
  if (matchedKeywordsCount > 0) return 0.5;
  return 0.3;
}
