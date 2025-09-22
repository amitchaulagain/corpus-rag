// API endpoint for checking Vertex AI operations status
import { json } from '@sveltejs/kit';
import { GoogleAuth } from 'google-auth-library';
import { GOOGLE_CLOUD_PROJECT_ID } from '$env/static/private';
import type { RequestHandler } from './$types.js';

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

export const GET: RequestHandler = async ({ url }) => {
  try {
    const operationId = url.searchParams.get('operationId');

    if (!operationId) {
      return json({ success: false, error: 'operationId parameter is required' }, { status: 400 });
    }

    console.log(`🔍 Checking operation status: ${operationId}`);

    const authClient = await auth.getClient();
    const accessToken = await authClient.getAccessToken();

    const headers = {
      'Authorization': `Bearer ${accessToken.token}`,
      'Content-Type': 'application/json'
    };

    // operationId is already a full resource name like:
    // projects/{project}/locations/{location}/operations/{operation}
    const operationUrl = `https://us-east4-aiplatform.clients6.google.com/ui/${operationId}?key=AIzaSyCI-zsRP85UVOi0DjtiCwWBwQ1djDy741g`;

    const response = await fetch(operationUrl, {
      method: 'GET',
      headers
    });

    console.log(`📊 Operation status response: ${response.status}`);

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Failed to check operation:`, error);
      return json({ success: false, error: `Failed to check operation: ${response.status} - ${error}` }, { status: 500 });
    }

    const result = await response.json();
    console.log(`✅ Operation status:`, result.done ? 'COMPLETED' : 'IN_PROGRESS');

    return json({
      success: true,
      operation: {
        name: result.name,
        done: result.done || false,
        metadata: result.metadata,
        response: result.response,
        error: result.error
      }
    });

  } catch (error) {
    console.error('Check operation error:', error);
    return json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
};