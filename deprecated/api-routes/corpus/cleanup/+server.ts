// API endpoint for cleaning up duplicate corpora
import { json } from '@sveltejs/kit';
import { VertexCorpusManager } from '$lib/corpus-manager.js';
import { GOOGLE_CLOUD_PROJECT_ID } from '$env/static/private';
import type { RequestHandler } from './$types.js';

const corpusManager = new VertexCorpusManager({
  projectId: GOOGLE_CLOUD_PROJECT_ID,
  location: 'us-east4'
});

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    const result = await corpusManager.cleanupDuplicateCorpora(userId);

    if (!result.success) {
      return json({ success: false, error: result.error }, { status: 500 });
    }

    return json({
      success: true,
      deletedCount: result.deletedCount,
      message: result.deletedCount > 0
        ? `Cleaned up ${result.deletedCount} duplicate corpora for user ${userId}`
        : `No duplicate corpora found for user ${userId}`
    });

  } catch (error) {
    console.error('Corpus cleanup error:', error);
    return json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
};