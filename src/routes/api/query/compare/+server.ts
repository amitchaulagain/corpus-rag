import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MultiProviderService } from '$lib/multi-provider-service';

const multiProvider = new MultiProviderService();

// POST /api/query/compare - Query all enabled providers and stream results
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { userId, question, skipDocuments } = body;
    const stream = body.stream !== false; // Default to true

    if (!userId || !question) {
      return json({ success: false, error: 'Missing userId or question' }, { status: 400 });
    }

    // Use empty userId if skipDocuments is true to prevent auto-attach
    const effectiveUserId = skipDocuments ? '' : userId;

    // If streaming is requested, use Server-Sent Events
    if (stream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            await multiProvider.queryAllStreaming(effectiveUserId, question, (providerId, result) => {
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

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }

    // Fallback to non-streaming (wait for all results)
    const results = await multiProvider.queryAll(effectiveUserId, question);

    return json({
      success: true,
      results
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Query failed'
      },
      { status: 500 }
    );
  }
};
