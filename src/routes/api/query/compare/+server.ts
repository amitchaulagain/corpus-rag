import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MultiProviderService } from '$lib/multi-provider-service';

const multiProvider = new MultiProviderService();

// POST /api/query/compare - Query all enabled providers and compare results
export const POST: RequestHandler = async ({ request }) => {
  try {
    const { userId, question } = await request.json();

    if (!userId || !question) {
      return json({ success: false, error: 'Missing userId or question' }, { status: 400 });
    }

    const results = await multiProvider.queryAll(userId, question);

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
