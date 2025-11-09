import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MultiProviderService } from '$lib/multi-provider-service';

const multiProvider = new MultiProviderService();

// POST /api/cover-letter/compare - Generate cover letter with all enabled providers
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { userId, prompt, jobDescription } = body;
    const stream = body.stream !== false; // Default to true

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

    // If streaming is requested, use Server-Sent Events
    if (stream) {
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            await multiProvider.queryAllStreaming(userId, fullPrompt, (providerId, result) => {
              // Send each result as it completes
              const data = `data: ${JSON.stringify({ providerId, result })}\n\n`;
              controller.enqueue(encoder.encode(data));
            });

            // Signal completion
            controller.enqueue(encoder.encode('data: {"done": true}\n\n'));
            controller.close();
          } catch (error) {
            const errorData = `data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Query failed' })}\n\n`;
            controller.enqueue(encoder.encode(errorData));
            controller.close();
          }
        }
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }

    // Fallback to non-streaming
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
