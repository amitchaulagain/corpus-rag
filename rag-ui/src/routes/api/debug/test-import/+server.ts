// Debug endpoint to test RAG import in us-east4
import { json } from '@sveltejs/kit';
import { GoogleAuth } from 'google-auth-library';
import { GOOGLE_CLOUD_PROJECT_ID } from '$env/static/private';
import type { RequestHandler } from './$types.js';

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { corpusId, fileUri } = await request.json();

    if (!corpusId || !fileUri) {
      return json({ success: false, error: 'corpusId and fileUri required' }, { status: 400 });
    }

    console.log(`🧪 Testing import for corpus: ${corpusId}`);
    console.log(`📄 File URI: ${fileUri}`);

    const authClient = await auth.getClient();
    const accessToken = await authClient.getAccessToken();

    const headers = {
      'Authorization': `Bearer ${accessToken.token}`,
      'Content-Type': 'application/json'
    };

    // Use the exact same format as working web UI
    const importUrl = `https://us-east4-aiplatform.clients6.google.com/ui/projects/${GOOGLE_CLOUD_PROJECT_ID}/locations/us-east4/ragCorpora/${corpusId}/ragFiles:import?key=AIzaSyCI-zsRP85UVOi0DjtiCwWBwQ1djDy741g`;

    console.log(`🌐 Testing Web UI URL: ${importUrl}`);

    // First, let's check if the corpus exists using the old API
    const listUrl = `https://us-east4-aiplatform.googleapis.com/v1beta1/projects/${GOOGLE_CLOUD_PROJECT_ID}/locations/us-east4/ragCorpora/${corpusId}`;

    const checkResponse = await fetch(listUrl, {
      method: 'GET',
      headers
    });

    console.log(`📊 Corpus check status: ${checkResponse.status}`);

    if (!checkResponse.ok) {
      const error = await checkResponse.text();
      return json({
        success: false,
        error: `Corpus doesn't exist: ${checkResponse.status} - ${error}`,
        corpusCheck: false
      });
    }

    const corpusData = await checkResponse.json();
    console.log(`✅ Corpus exists:`, corpusData.displayName);

    // Use the exact same payload format as web UI
    const requestBody = {
      "importRagFilesConfig": {
        "gcsSource": {
          "uris": [fileUri]
        },
        "ragFileTransformationConfig": {
          "ragFileChunkingConfig": {
            "fixedLengthChunking": {
              "chunkSize": 1024,
              "chunkOverlap": 256
            }
          }
        },
        "maxEmbeddingRequestsPerMin": 1000
      }
    };

    console.log(`📦 Request body:`, JSON.stringify(requestBody, null, 2));

    const importResponse = await fetch(importUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    console.log(`📊 Import response status: ${importResponse.status}`);

    if (!importResponse.ok) {
      const error = await importResponse.text();
      console.error(`❌ Import failed:`, error);
      return json({
        success: false,
        error: `Import failed: ${importResponse.status} - ${error}`,
        corpusCheck: true,
        corpusData
      });
    }

    const result = await importResponse.json();
    console.log(`✅ Import successful:`, result);

    return json({
      success: true,
      result,
      corpusCheck: true,
      corpusData
    });

  } catch (error) {
    console.error('Debug import error:', error);
    return json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
};