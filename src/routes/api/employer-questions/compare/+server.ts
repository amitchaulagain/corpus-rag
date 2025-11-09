import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MultiProviderService } from '$lib/multi-provider-service';

const multiProvider = new MultiProviderService();

// POST /api/employer-questions/compare - Generate answers with all enabled providers
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { userId, prompt, questions, details } = body;
    const stream = body.stream !== false; // Default to true

    if (!userId || !prompt || !questions) {
      return json({
        success: false,
        error: 'Missing userId, prompt, or questions'
      }, { status: 400 });
    }

    // Build the full prompt with questions
    const questionsText = questions.map((q: any, i: number) =>
      `Q${i+1} (${q.type || 'select'}): ${q.q}\nOptions: ${(q.options || q.opts || []).join(', ')}`
    ).join('\n\n');

    const fullPrompt = `${prompt}\n\n${details ? `JOB DESCRIPTION:\n${details}\n\n` : ''}QUESTIONS:\n${questionsText}`;

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
    const resultsMap = await multiProvider.queryAll(userId, fullPrompt);

    // Transform the results map into an array format expected by the frontend
    const results = Object.entries(resultsMap).map(([providerId, response]) => ({
      providerId,
      error: response.success ? undefined : response.error,
      text: response.answer,
      metadata: response.metadata
    }));

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