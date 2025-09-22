// API endpoint for getting or creating user-specific corpus
import { json } from '@sveltejs/kit';
import { VertexCorpusManager } from '$lib/corpus-manager.js';
import { GOOGLE_CLOUD_PROJECT_ID } from '$env/static/private';
import type { RequestHandler } from './$types.js';

const corpusManager = new VertexCorpusManager({
  projectId: GOOGLE_CLOUD_PROJECT_ID,
  location: 'us-east4' // TODO: Make this configurable
});

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    const result = await corpusManager.getUserCorpus(userId);

    if (!result.success) {
      return json({ success: false, error: result.error }, { status: 500 });
    }

    return json({
      success: true,
      corpusId: result.corpusId,
      exists: result.exists,
      message: result.exists
        ? `Found existing corpus for user ${userId}`
        : `Created new corpus for user ${userId}`
    });

  } catch (error) {
    console.error('Get corpus error:', error);
    return json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
};

export const GET: RequestHandler = async ({ url }) => {
  try {
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return json({ success: false, error: 'userId parameter is required' }, { status: 400 });
    }

    const result = await corpusManager.getUserCorpus(userId);

    if (!result.success) {
      return json({ success: false, error: result.error }, { status: 500 });
    }

    return json({
      success: true,
      corpusId: result.corpusId,
      exists: result.exists
    });

  } catch (error) {
    console.error('Get corpus error:', error);
    return json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
};