// Types for answer references and citations

export interface AnswerSource {
  type: 'generic_question' | 'resume' | 'job_description' | 'ai_inference' | 'rag_chunk';
  reference: string; // Human-readable reference
  matchDetails?: {
    genericQuestionId?: string;
    keywords?: string[];
    matchedKeywords?: string[];
    confidence?: number;
  };
  chunkId?: string;
  docId?: string;
  score?: number;
  reason?: string;
  docType?: string;
  excerpt?: string; // Relevant excerpt from source
}

export interface AnswerWithReferences {
  answer: string | number | number[]; // The actual answer
  sources?: AnswerSource[];
}

export type ParsedAnswer = AnswerWithReferences | string | number | number[];

// Helper to check if answer has references
export function hasReferences(answer: ParsedAnswer): answer is AnswerWithReferences {
  return typeof answer === 'object' && answer !== null && !Array.isArray(answer) && 'answer' in answer;
}

// Helper to extract answer value
export function getAnswerValue(answer: ParsedAnswer): string | number | number[] {
  if (hasReferences(answer)) {
    return answer.answer;
  }
  return answer;
}

// Helper to extract sources
export function getAnswerSources(answer: ParsedAnswer): AnswerSource[] {
  if (hasReferences(answer)) {
    return answer.sources || [];
  }
  return [];
}
