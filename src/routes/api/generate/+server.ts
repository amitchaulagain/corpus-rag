// AI Generation API endpoint
import type { RequestHandler } from './$types';
import { authenticateRequest, handleApiRequest, requireScope, handleOptions, addCorsHeaders } from '$lib/api-utils.js';

// Handle preflight OPTIONS requests
export const OPTIONS: RequestHandler = () => {
  return handleOptions();
};

// POST /api/generate - Generate cover letter or employer answers using AI
export const POST: RequestHandler = async (event) => {
  const auth = await authenticateRequest(event);
  if (auth instanceof Response) {
    return addCorsHeaders(auth);
  }

  if (!requireScope(auth, 'rag:query')) {
    return addCorsHeaders(new Response(JSON.stringify({ success: false, error: 'Insufficient permissions' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  const response = await handleApiRequest(async () => {
    const requestBody = await event.request.json();
    const { type, jobDetails, questions, userEmail, customPrompt } = requestBody;

    if (!type || !userEmail) {
      throw new Error('Type and user email are required');
    }

    let prompt = '';

    if (type === 'cover_letter') {
      if (!jobDetails) {
        throw new Error('Job details are required for cover letter generation');
      }

      // Use custom prompt if provided, otherwise use default
      if (customPrompt) {
        prompt = `${customPrompt}

Job Details: ${JSON.stringify(jobDetails, null, 2)}`;
      } else {
        prompt = `Write a compelling cover letter for this position: ${JSON.stringify(jobDetails, null, 2)}

Use my background from the resume and user info to:
- Address their specific pain points mentioned in the job posting
- Highlight 2-3 most relevant experiences
- Match their company tone/culture if discernible
- Keep it under 300 words
- End with a strong call to action

Please format as a professional cover letter with proper greeting and closing.`;
      }

    } else if (type === 'employer_answers') {
      if (!questions || !Array.isArray(questions)) {
        throw new Error('Questions array is required for employer answers');
      }

      const questionsText = questions.map((q, index) =>
        `Question ${index + 1}: ${q.q}\nOptions: ${q.opts.join(', ')}`
      ).join('\n\n');

      // Use custom prompt if provided, otherwise use default
      if (customPrompt) {
        prompt = `${customPrompt}

Questions: ${questionsText}`;
      } else {
        prompt = `For each of these employer questions: ${questionsText}

Provide the best answer choice and a brief rationale. Consider:
- My actual experience level and background
- What the employer is really asking (subtext)
- Which answer positions me as the ideal candidate
- Consistency with my resume and cover letter

Format: Question → Recommended Answer → 2-sentence rationale

Please be specific about which option number (starting from 0) to select for each question.`;
      }

    } else {
      throw new Error('Invalid generation type. Must be "cover_letter" or "employer_answers"');
    }

    // Call the RAG query endpoint to generate response
    const ragResponse = await fetch(`${event.url.origin}/api/rag/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': event.request.headers.get('Authorization') || ''
      },
      body: JSON.stringify({
        userId: userEmail,
        question: prompt,
        maxTokens: 2000,
        temperature: 0.7
      })
    });

    if (!ragResponse.ok) {
      const errorData = await ragResponse.text();
      throw new Error(`AI generation failed: ${ragResponse.status} - ${errorData}`);
    }

    const ragResult = await ragResponse.json();

    if (!ragResult.success) {
      throw new Error(`AI generation failed: ${ragResult.error}`);
    }

    // Handle both authenticated and legacy response structures
    const answer = ragResult.data ? ragResult.data.answer : ragResult.answer;

    if (!answer) {
      throw new Error('AI response is empty or invalid');
    }

    return {
      type,
      generatedText: answer,
      prompt: prompt.substring(0, 200) + '...' // Truncated prompt for reference
    };
  });

  return addCorsHeaders(response);
};