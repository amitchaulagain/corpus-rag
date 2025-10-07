import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MultiProviderService } from '$lib/multi-provider-service';

const multiProvider = new MultiProviderService();

// POST /api/cover-letter/compare - Generate cover letter with all enabled providers
export const POST: RequestHandler = async ({ request }) => {
  try {
    const { userId, prompt, jobDescription } = await request.json();

    if (!userId || !prompt || !jobDescription) {
      return json({
        success: false,
        error: 'Missing userId, prompt, or jobDescription'
      }, { status: 400 });
    }

    // Build the full prompt with job description and user's resume/files
    const fullPrompt = `${prompt}

JOB DESCRIPTION:
${jobDescription}

Please write a compelling cover letter based on the above job description and my resume/documents.`;

    const results = await multiProvider.queryAll(userId, fullPrompt);

    return json({
      success: true,
      results
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Cover letter generation failed'
      },
      { status: 500 }
    );
  }
};
