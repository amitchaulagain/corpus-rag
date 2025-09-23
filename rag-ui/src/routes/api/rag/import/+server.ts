import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { VertexRAGClient } from '$lib/rag-client';
import { GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_API_KEY } from '$env/static/private';
import { authenticateRequest, handleApiRequest, requireScope, validators, validationError, handleOptions, addCorsHeaders } from '$lib/api-utils.js';

const rag = new VertexRAGClient({
  projectId: GOOGLE_CLOUD_PROJECT_ID,
  location: 'us-east4',
  apiKey: GOOGLE_CLOUD_API_KEY
  // No ragCorpusId - will be resolved per user
});

// Handle preflight OPTIONS requests
export const OPTIONS: RequestHandler = () => {
  return handleOptions();
};

export const POST: RequestHandler = async (event) => {
  // Check for API authentication for external access
  const authHeader = event.request.headers.get('Authorization');
  const hasApiKey = authHeader && authHeader.startsWith('Bearer ');

  if (hasApiKey) {
    // External API access - require authentication
    const auth = await authenticateRequest(event);
    if (auth instanceof Response) {
      return addCorsHeaders(auth);
    }

    if (!requireScope(auth, 'rag:import')) {
      return addCorsHeaders(new Response(JSON.stringify({ success: false, error: 'Insufficient permissions' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }));
    }

    // Handle authenticated API request
    const response = await handleApiRequest(async () => {
      const requestBody = await event.request.json().catch(() => null);
      const validated = validators.importRequest(requestBody);

      if (!validated) {
        throw new Error('userId and cloudStorageUris array are required');
      }

      const userId = validated.userId || auth.user.id;

      const result = await rag.importFiles({
        userId,
        cloudStorageUris: validated.cloudStorageUris
      });

      if (!result.success) {
        throw new Error(result.error || 'Import failed');
      }

      return {
        message: `Import started for ${validated.cloudStorageUris.length} files`,
        operationId: result.operationId,
        filesCount: validated.cloudStorageUris.length,
        corpusId: result.corpusId || 'unknown'
      };
    });

    return addCorsHeaders(response);
  }

  // Legacy UI access - no authentication required for backward compatibility
  try {
    const { userId, cloudStorageUris } = await event.request.json();

    if (!userId || !cloudStorageUris || !Array.isArray(cloudStorageUris)) {
      return json({ error: 'Missing userId or cloudStorageUris array' }, { status: 400 });
    }

    const result = await rag.importFiles({ userId, cloudStorageUris });

    if (!result.success) {
      return json({ error: result.error }, { status: 500 });
    }

    return json({
      success: true,
      operationId: result.operationId,
      message: `Import started for ${cloudStorageUris.length} files`
    });
  } catch (error) {
    return json({ error: 'Import failed' }, { status: 500 });
  }
};