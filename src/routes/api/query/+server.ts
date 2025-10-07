import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MultiProviderService } from '$lib/multi-provider-service';

const multiProvider = new MultiProviderService();

// POST /api/query - Query a single provider
export const POST: RequestHandler = async ({ request }) => {
  try {
    const { userId, question, providerId } = await request.json();

    if (!userId || !question || !providerId) {
      return json(
        { success: false, error: 'Missing userId, question, or providerId' },
        { status: 400 }
      );
    }

    const result = await multiProvider.querySingle(userId, question, providerId);

    return json({
      success: result.success,
      answer: result.answer,
      error: result.error,
      metadata: result.metadata
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
