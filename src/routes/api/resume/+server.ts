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
      fullPrompt = `Create a tailored resume for this position: ${typeof job_details === 'string' ? job_details : JSON.stringify(job_details, null, 2)}

Using my background and experience:
- Tailor the resume to match the job requirements
- Highlight relevant skills and experiences
- Use keywords from the job posting
- Format professionally with clear sections
- Keep it concise and impactful
- Include relevant technical skills and tools
- Show quantifiable achievements where possible

Please format as a complete resume with sections for:
- Contact Information (use placeholder data)
- Professional Summary
- Work Experience
- Skills
- Education
- Additional relevant sections as needed`;
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
          error: result.error || 'Resume generation failed'
        },
        { status: 500 }
      );
    }

    // Return only resume and job_id
    return json({
      resume: result.answer,
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
