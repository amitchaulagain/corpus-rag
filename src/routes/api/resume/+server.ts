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
    const { jobDetails, userEmail, customPrompt, resumeType = 'tailored' } = requestBody;

    if (!jobDetails || !userEmail) {
      throw new Error('jobDetails and userEmail are required');
    }

    let prompt = '';

    if (customPrompt) {
      prompt = `${customPrompt}

Job Details: ${JSON.stringify(jobDetails, null, 2)}`;
    } else {
      prompt = `Create a tailored resume for this position: ${JSON.stringify(jobDetails, null, 2)}

Using my background and experience:
- Tailor the resume to match the job requirements
- Highlight relevant skills and experiences
- Use keywords from the job posting
- Format professionally with clear sections
- Keep it concise and impactful
- Include relevant technical skills and tools
- Show quantifiable achievements where possible

Resume Type: ${resumeType}

Please format as a complete resume with sections for:
- Contact Information (use placeholder data)
- Professional Summary
- Work Experience
- Skills
- Education
- Additional relevant sections as needed`;
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
        maxTokens: 2500,
        temperature: 0.7
      })
    });

    if (!ragResponse.ok) {
      const errorData = await ragResponse.text();
      throw new Error(`Resume generation failed: ${ragResponse.status} - ${errorData}`);
    }

    const ragResult = await ragResponse.json();

    if (!ragResult.success) {
      throw new Error(`Resume generation failed: ${ragResult.error}`);
    }

    const answer = ragResult.data ? ragResult.data.answer : ragResult.answer;

    if (!answer) {
      throw new Error('Generated resume is empty or invalid');
    }

    return {
      resume: answer,
      resumeType,
      prompt: prompt.substring(0, 200) + '...'
    };
  });

  return addCorsHeaders(response);
};