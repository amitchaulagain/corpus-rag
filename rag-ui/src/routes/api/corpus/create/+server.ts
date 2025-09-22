// API endpoint for creating user-specific corpus
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
    const { userId, displayName, description } = await request.json();

    if (!userId) {
      return json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    const result = await corpusManager.createUserCorpus({
      userId,
      displayName,
      description
    });

    if (!result.success) {
      return json({ success: false, error: result.error }, { status: 500 });
    }

    return json({
      success: true,
      corpusId: result.corpusId,
      message: `Corpus created for user ${userId}`
    });

  } catch (error) {
    console.error('Corpus creation error:', error);
    return json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
};