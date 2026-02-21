export const PAYLOAD_LIMITS = {
  maxRequestBodyBytes: 2_000_000,
  maxResumeTextChars: 1_000_000,
  maxJobDetailsChars: 250_000,
  maxPromptChars: 120_000,
  maxQuestionsCount: 120,
  maxQuestionTextChars: 2_000,
  maxOptionsPerQuestion: 40,
  maxOptionTextChars: 500
} as const;

function textLength(value: unknown): number {
  if (typeof value === 'string') return value.length;
  if (value == null) return 0;
  try {
    return JSON.stringify(value).length;
  } catch {
    return String(value).length;
  }
}

export function estimateRequestBodyBytes(body: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(body ?? {}), 'utf8');
  } catch {
    return Buffer.byteLength(String(body ?? ''), 'utf8');
  }
}

export function validatePayloadGuardrails(input: {
  body: unknown;
  resumeText?: unknown;
  jobDetails?: unknown;
  prompt?: unknown;
  questions?: unknown;
}): string[] {
  const errors: string[] = [];
  const bodyBytes = estimateRequestBodyBytes(input.body);
  if (bodyBytes > PAYLOAD_LIMITS.maxRequestBodyBytes) {
    errors.push(`Request payload too large (${bodyBytes} bytes > ${PAYLOAD_LIMITS.maxRequestBodyBytes} bytes).`);
  }

  const resumeLen = textLength(input.resumeText);
  if (resumeLen > PAYLOAD_LIMITS.maxResumeTextChars) {
    errors.push(`resume_text exceeds ${PAYLOAD_LIMITS.maxResumeTextChars} characters.`);
  }

  const detailsLen = textLength(input.jobDetails);
  if (detailsLen > PAYLOAD_LIMITS.maxJobDetailsChars) {
    errors.push(`job_details exceeds ${PAYLOAD_LIMITS.maxJobDetailsChars} characters.`);
  }

  const promptLen = textLength(input.prompt);
  if (promptLen > PAYLOAD_LIMITS.maxPromptChars) {
    errors.push(`prompt exceeds ${PAYLOAD_LIMITS.maxPromptChars} characters.`);
  }

  if (Array.isArray(input.questions)) {
    if (input.questions.length > PAYLOAD_LIMITS.maxQuestionsCount) {
      errors.push(`questions exceeds ${PAYLOAD_LIMITS.maxQuestionsCount} items.`);
    }
    for (let i = 0; i < input.questions.length; i++) {
      const q = input.questions[i] as any;
      const qTextLen = textLength(q?.q ?? q?.question ?? q?.text ?? '');
      if (qTextLen > PAYLOAD_LIMITS.maxQuestionTextChars) {
        errors.push(`questions[${i}] text exceeds ${PAYLOAD_LIMITS.maxQuestionTextChars} characters.`);
      }
      const options = Array.isArray(q?.opts) ? q.opts : Array.isArray(q?.options) ? q.options : [];
      if (options.length > PAYLOAD_LIMITS.maxOptionsPerQuestion) {
        errors.push(`questions[${i}] options exceed ${PAYLOAD_LIMITS.maxOptionsPerQuestion} items.`);
      }
      for (let j = 0; j < options.length; j++) {
        const optLen = textLength(options[j]);
        if (optLen > PAYLOAD_LIMITS.maxOptionTextChars) {
          errors.push(`questions[${i}].options[${j}] exceeds ${PAYLOAD_LIMITS.maxOptionTextChars} characters.`);
        }
      }
    }
  }

  return errors;
}
