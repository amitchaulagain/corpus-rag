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
    const { jobDetails, userEmail, customPrompt } = requestBody;

    if (!jobDetails || !userEmail) {
      throw new Error('jobDetails and userEmail are required');
    }

    let prompt = '';

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
      throw new Error(`Cover letter generation failed: ${ragResponse.status} - ${errorData}`);
    }

    const ragResult = await ragResponse.json();

    if (!ragResult.success) {
      throw new Error(`Cover letter generation failed: ${ragResult.error}`);
    }

    const answer = ragResult.data ? ragResult.data.answer : ragResult.answer;

    if (!answer) {
      throw new Error('Generated cover letter is empty or invalid');
    }

    return {
      coverLetter: answer,
      prompt: prompt.substring(0, 200) + '...'
    };
  });

  return addCorsHeaders(response);
};