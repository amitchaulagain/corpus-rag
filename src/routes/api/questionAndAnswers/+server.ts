import type { RequestHandler } from './$types';
import { authenticateRequest, handleApiRequest, requireScope, handleOptions, addCorsHeaders } from '$lib/api-utils.js';

export const OPTIONS: RequestHandler = () => {
  return handleOptions();
};

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
    const { questions, userEmail, customPrompt, jobDetails } = requestBody;

    if (!questions || !Array.isArray(questions) || !userEmail) {
      throw new Error('questions array and userEmail are required');
    }

    const questionsText = questions.map((q, index) =>
      `Question ${index + 1}: ${q.q || q.question || q.text}
Options: ${(q.opts || q.options || []).join(', ')}`
    ).join('\n\n');

    let prompt = '';

    if (customPrompt) {
      prompt = `${customPrompt}

Questions: ${questionsText}
${jobDetails ? `\nJob Details: ${JSON.stringify(jobDetails, null, 2)}` : ''}`;
    } else {
      prompt = `For each of these employer questions: ${questionsText}

Provide the best answer choice and a brief rationale. Consider:
- My actual experience level and background
- What the employer is really asking (subtext)
- Which answer positions me as the ideal candidate
- Consistency with my resume and cover letter
${jobDetails ? '- Alignment with the specific job requirements' : ''}

Format: Question → Recommended Answer → 2-sentence rationale

Please be specific about which option number (starting from 0) to select for each question.
${jobDetails ? `\nJob Context: ${JSON.stringify(jobDetails, null, 2)}` : ''}`;
    }

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
      throw new Error(`Question answers generation failed: ${ragResponse.status} - ${errorData}`);
    }

    const ragResult = await ragResponse.json();

    if (!ragResult.success) {
      throw new Error(`Question answers generation failed: ${ragResult.error}`);
    }

    const answer = ragResult.data ? ragResult.data.answer : ragResult.answer;

    if (!answer) {
      throw new Error('Generated question answers are empty or invalid');
    }

    return {
      answers: answer,
      questionsCount: questions.length,
      prompt: prompt.substring(0, 200) + '...'
    };
  });

  return addCorsHeaders(response);
};