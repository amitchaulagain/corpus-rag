import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MultiProviderService } from '$lib/multi-provider-service';

const multiProvider = new MultiProviderService();

export const POST: RequestHandler = async ({ request }) => {
  try {
    const requestBody = await request.json();
    const { job_id, job_details, resume_text, useAi, prompt } = requestBody;

    // Validate required fields
    if (!job_id || !job_details || !resume_text || !useAi) {
      return json(
        {
          success: false,
          error: 'Missing required fields: job_id, job_details, resume_text, useAi are required'
        },
        { status: 400 }
      );
    }

    // Build the full prompt for AI
    // Use user's custom prompt if provided, otherwise use default
    let fullPrompt = '';

    if (prompt) {
      // User provided their own prompt - use it as the main instruction
      fullPrompt = `${prompt}

JOB DESCRIPTION:
${typeof job_details === 'string' ? job_details : JSON.stringify(job_details, null, 2)}`;
    } else {
      // Fallback to default prompt
      fullPrompt = `Write a compelling cover letter for this position: ${typeof job_details === 'string' ? job_details : JSON.stringify(job_details, null, 2)}

Use my background from the resume to:
- Address their specific pain points mentioned in the job posting
- Highlight 2-3 most relevant experiences
- Match their company tone/culture if discernible
- Keep it under 300 words
- End with a strong call to action

Please format as a professional cover letter with proper greeting and closing.`;
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
          error: result.error || 'Cover letter generation failed'
        },
        { status: 500 }
      );
    }

    // Return only cover_letter and job_id
    return json({
      cover_letter: result.answer,
      job_id
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
