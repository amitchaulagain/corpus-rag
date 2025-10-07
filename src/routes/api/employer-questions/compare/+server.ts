import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MultiProviderService } from '$lib/multi-provider-service';

const multiProvider = new MultiProviderService();

// POST /api/employer-questions/compare - Generate answers with all enabled providers
export const POST: RequestHandler = async ({ request }) => {
  try {
    const { userId, prompt, questions, details } = await request.json();

    if (!userId || !prompt || !questions) {
      return json({
        success: false,
        error: 'Missing userId, prompt, or questions'
      }, { status: 400 });
    }

    // Build the full prompt with questions
    const questionsText = questions.map((q: any, i: number) => 
      `Q${i+1} (${q.type || 'select'}): ${q.q}\nOptions: ${q.opts.join(', ')}`
    ).join('\n\n');

    const fullPrompt = `${prompt}\n\n${details ? `JOB DESCRIPTION:\n${details}\n\n` : ''}QUESTIONS:\n${questionsText}`;

    const results = await multiProvider.queryAll(userId, fullPrompt);

    return json({
      success: true,
      results
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Employer questions generation failed'
      },
      { status: 500 }
    );
  }
};