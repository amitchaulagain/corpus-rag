export type QuestionAnswerValue = string | number | number[];

export interface AnswerValidationResult {
  valid: boolean;
  parsed: QuestionAnswerValue[];
  reason?: string;
}

export function parseResponseArray(response: string): QuestionAnswerValue[] {
  const clean = response.trim();
  const start = clean.indexOf('[');
  if (start < 0) return [];

  let depth = 0;
  let end = -1;
  for (let i = start; i < clean.length; i++) {
    if (clean[i] === '[') depth++;
    if (clean[i] === ']') depth--;
    if (depth === 0) {
      end = i;
      break;
    }
  }
  if (end < 0) return [];

  const payload = clean.slice(start, end + 1);
  const parsed = JSON.parse(payload);
  return Array.isArray(parsed) ? parsed as QuestionAnswerValue[] : [];
}

export function validateQuestionAnswers(
  responseText: string,
  questions: Array<{ type?: string; opts?: string[]; options?: string[] }>
): AnswerValidationResult {
  let parsed: QuestionAnswerValue[] = [];
  try {
    parsed = parseResponseArray(responseText);
  } catch (error) {
    return { valid: false, parsed: [], reason: `Invalid JSON array: ${String(error)}` };
  }

  if (parsed.length !== questions.length) {
    return {
      valid: false,
      parsed,
      reason: `Answer length mismatch. expected=${questions.length} actual=${parsed.length}`
    };
  }

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const type = q.type ?? 'select';
    const options = q.opts ?? q.options ?? [];
    const answer = parsed[i];

    if (type === 'checkbox') {
      if (!Array.isArray(answer)) {
        return { valid: false, parsed, reason: `Q${i + 1} expected checkbox array` };
      }
      for (const idx of answer) {
        if (typeof idx !== 'number' || idx < 0 || idx >= options.length) {
          return { valid: false, parsed, reason: `Q${i + 1} checkbox index out of range: ${String(idx)}` };
        }
      }
      continue;
    }

    if (type === 'text') {
      if (typeof answer !== 'string' && typeof answer !== 'number') {
        return { valid: false, parsed, reason: `Q${i + 1} expected text/number` };
      }
      continue;
    }

    if (typeof answer !== 'number' || answer < 0 || answer >= options.length) {
      return { valid: false, parsed, reason: `Q${i + 1} select index out of range` };
    }
  }

  return { valid: true, parsed };
}
