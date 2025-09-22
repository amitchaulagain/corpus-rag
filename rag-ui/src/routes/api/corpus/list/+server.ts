// API endpoint for listing all corpora
import { json } from '@sveltejs/kit';
import { VertexCorpusManager } from '$lib/corpus-manager.js';
import { GOOGLE_CLOUD_PROJECT_ID } from '$env/static/private';
import type { RequestHandler } from './$types.js';

const corpusManager = new VertexCorpusManager({
  projectId: GOOGLE_CLOUD_PROJECT_ID,
  location: 'us-east4' // TODO: Make this configurable
});

export const GET: RequestHandler = async () => {
  try {
    const result = await corpusManager.listCorpora();

    if (!result.success) {
      return json({ success: false, error: result.error }, { status: 500 });
    }

    return json({
      success: true,
      corpora: result.corpora
    });

  } catch (error) {
    console.error('List corpora error:', error);
    return json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
};