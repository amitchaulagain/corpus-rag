// API endpoint for listing files in Vertex AI RAG corpus
import { json } from '@sveltejs/kit';
import { GoogleAuth } from 'google-auth-library';
import { GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types.js';

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

export const GET: RequestHandler = async ({ url }) => {
  try {
    const corpusId = url.searchParams.get('corpusId');

    if (!corpusId) {
      return json({ success: false, error: 'corpusId parameter is required' }, { status: 400 });
    }

    console.log(`🔍 Listing Vertex AI files for corpus: ${corpusId}`);

    const authClient = await auth.getClient();
    const accessToken = await authClient.getAccessToken();

    const headers = {
      'Authorization': `Bearer ${accessToken.token}`,
      'Content-Type': 'application/json'
    };

    // Try the clients6 endpoint first, fallback to googleapis if needed
    const listUrl = `https://us-east4-aiplatform.clients6.google.com/ui/projects/${GOOGLE_CLOUD_PROJECT_ID}/locations/us-east4/ragCorpora/${corpusId}/ragFiles?key=${GOOGLE_CLOUD_API_KEY}`;

    const response = await fetch(listUrl, {
      method: 'GET',
      headers
    });

    // If clients6 fails, try the old googleapis endpoint
    if (!response.ok && response.status === 404) {
      console.log(`⚠️ clients6 endpoint failed, trying googleapis endpoint`);
      const fallbackUrl = `https://us-east4-aiplatform.googleapis.com/v1beta1/projects/${GOOGLE_CLOUD_PROJECT_ID}/locations/us-east4/ragCorpora/${corpusId}/ragFiles`;

      const fallbackResponse = await fetch(fallbackUrl, {
        method: 'GET',
        headers
      });

      if (fallbackResponse.ok) {
        const result = await fallbackResponse.json();
        console.log(`✅ Found ${result.ragFiles?.length || 0} files in Vertex AI corpus (via googleapis)`);

        const files = (result.ragFiles || []).map((ragFile: any) => ({
          name: ragFile.displayName || ragFile.name?.split('/').pop() || 'Unknown',
          ragFileId: ragFile.name,
          gcsSource: ragFile.gcsSource,
          sizeBytes: ragFile.sizeBytes,
          createTime: ragFile.createTime,
          updateTime: ragFile.updateTime,
          ragFileType: ragFile.ragFileType,
          problemMessage: ragFile.problemMessage,
          state: ragFile.state
        }));

        return json({
          success: true,
          files,
          corpusId,
          totalFiles: files.length,
          endpoint: 'googleapis'
        });
      }
    }

    console.log(`📊 Vertex AI files response status: ${response.status}`);

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Failed to list Vertex AI files:`, error);
      return json({ success: false, error: `Failed to list files: ${response.status} - ${error}` }, { status: 500 });
    }

    const result = await response.json();
    console.log(`✅ Found ${result.ragFiles?.length || 0} files in Vertex AI corpus`);

    const files = (result.ragFiles || []).map((ragFile: any) => ({
      name: ragFile.displayName || ragFile.name?.split('/').pop() || 'Unknown',
      ragFileId: ragFile.name,
      gcsSource: ragFile.gcsSource,
      sizeBytes: ragFile.sizeBytes,
      createTime: ragFile.createTime,
      updateTime: ragFile.updateTime,
      ragFileType: ragFile.ragFileType,
      problemMessage: ragFile.problemMessage,
      state: ragFile.state
    }));

    return json({
      success: true,
      files,
      corpusId,
      totalFiles: files.length
    });

  } catch (error) {
    console.error('List Vertex AI files error:', error);
    return json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
};