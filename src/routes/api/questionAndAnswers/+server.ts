import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MultiProviderService } from '$lib/multi-provider-service';

const multiProvider = new MultiProviderService();

export const POST: RequestHandler = async ({ request }) => {
  try {
    const requestBody = await request.json();
    const { job_id, questions, resume_text, useAi, prompt, job_details } = requestBody;

    // Validate required fields
    if (!job_id || !questions || !Array.isArray(questions) || !resume_text || !useAi) {
      return json(
        {
          success: false,
          error: 'Missing required fields: job_id, questions (array), resume_text, useAi are required'
        },
        { status: 400 }
      );
    }

    // Format questions for the prompt
    const questionsText = questions.map((q, index) =>
      `Question ${index + 1}: ${q.q || q.question || q.text}
Options: ${(q.opts || q.options || []).join(', ')}`
    ).join('\n\n');

    // Build the full prompt for AI
    // Use user's custom prompt if provided, otherwise use default
    let fullPrompt = '';

    if (prompt) {
      // User provided their own prompt - use it as the main instruction
      fullPrompt = `${prompt}

QUESTIONS:
${questionsText}
${job_details ? `\nJOB DESCRIPTION:\n${typeof job_details === 'string' ? job_details : JSON.stringify(job_details, null, 2)}` : ''}`;
    } else {
      // Fallback to default prompt
      fullPrompt = `For each of these employer questions: ${questionsText}

Provide the best answer choice and a brief rationale. Consider:
- My actual experience level and background
- What the employer is really asking (subtext)
- Which answer positions me as the ideal candidate
- Consistency with my resume and cover letter
${job_details ? '- Alignment with the specific job requirements' : ''}

Format: Question → Recommended Answer → 2-sentence rationale

Please be specific about which option number (starting from 0) to select for each question.
${job_details ? `\nJob Context: ${typeof job_details === 'string' ? job_details : JSON.stringify(job_details, null, 2)}` : ''}`;
    }

    // Query the AI provider with resume text
    const result = await multiProvider.querySingle(
      'external', // dummy userId since we're not using file storage
      fullPrompt,
      useAi,
      resume_text
    );

    if (!result.success) {
      return json(
        {
          success: false,
          error: result.error || 'Question answers generation failed'
        },
        { status: 500 }
      );
    }

    // Return answers and job_id
    return json({
      answers: result.answer,
      job_id,
      questions_count: questions.length
    });

  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
};
