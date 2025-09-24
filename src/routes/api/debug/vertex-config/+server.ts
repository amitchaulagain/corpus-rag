// Debug endpoint to check Vertex AI configuration
import { json } from '@sveltejs/kit';
import { VertexCorpusManager } from '$lib/corpus-manager.js';
import { GOOGLE_CLOUD_PROJECT_ID } from '$env/static/private';
import type { RequestHandler } from './$types.js';

const corpusManager = new VertexCorpusManager({
  projectId: GOOGLE_CLOUD_PROJECT_ID,
  location: 'us-central1' // Try us-central1 which is more commonly supported
});

export const GET: RequestHandler = async () => {
  try {
    console.log('🔍 Debugging Vertex AI configuration...');

    // Test basic API connectivity
    const listResult = await corpusManager.listCorpora();

    return json({
      success: true,
      config: {
        projectId: GOOGLE_CLOUD_PROJECT_ID,
        location: 'us-central1',
        timestamp: new Date().toISOString()
      },
      apiTest: {
        listCorpora: {
          success: listResult.success,
          corporaCount: listResult.corpora?.length || 0,
          error: listResult.error
        }
      },
      debugInfo: {
        expectedImportUrl: `https://us-central1-aiplatform.googleapis.com/v1beta1/projects/${GOOGLE_CLOUD_PROJECT_ID}/locations/us-central1/ragCorpora/[CORPUS_ID]:importRagFiles`,
        expectedListUrl: `https://us-central1-aiplatform.googleapis.com/v1beta1/projects/${GOOGLE_CLOUD_PROJECT_ID}/locations/us-central1/ragCorpora`
      }
    });

  } catch (error) {
    console.error('Debug config error:', error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        config: {
          projectId: GOOGLE_CLOUD_PROJECT_ID,
          location: 'us-central1'
        }
      },
      { status: 500 }
    );
  }
};