import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { RAGStorageClient } from '$lib/storage-client';
import { GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_BUCKET_NAME } from '$env/static/private';
import { authenticateRequest, handleApiRequest, requireScope, handleOptions, addCorsHeaders } from '$lib/api-utils.js';

const storage = new RAGStorageClient({
  projectId: GOOGLE_CLOUD_PROJECT_ID,
  bucketName: GOOGLE_CLOUD_BUCKET_NAME
});

// Handle preflight OPTIONS requests
export const OPTIONS: RequestHandler = () => {
  return handleOptions();
};

export const GET: RequestHandler = async (event) => {
  // Check for API authentication for external access
  const authHeader = event.request.headers.get('Authorization');
  const hasApiKey = authHeader && authHeader.startsWith('Bearer ');

  if (hasApiKey) {
    // External API access - require authentication
    const auth = await authenticateRequest(event);
    if (auth instanceof Response) {
      return addCorsHeaders(auth);
    }

    if (!requireScope(auth, 'files:read')) {
      return addCorsHeaders(new Response(JSON.stringify({ success: false, error: 'Insufficient permissions' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }));
    }

    // Handle authenticated API request
    const response = await handleApiRequest(async () => {
      const userId = event.url.searchParams.get('userId') || auth.user.id;
      const result = await storage.listUserFiles(userId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to list files');
      }

      // Transform files to API format
      const files = (result.files || []).map(file => ({
        id: file.fileId || file.name,
        name: file.name,
        size: file.size,
        mimeType: file.mimeType || 'application/octet-stream',
        userId,
        fileId: file.fileId,
        fullPath: file.fullPath,
        created: file.created,
        updated: file.updated
      }));

      return { files };
    });

    return addCorsHeaders(response);
  }

  // Legacy UI access - no authentication required for backward compatibility
  try {
    const userId = event.url.searchParams.get('userId');

    if (!userId) {
      return json({ error: 'Missing userId' }, { status: 400 });
    }

    const result = await storage.listUserFiles(userId);

    if (!result.success) {
      return json({ error: result.error }, { status: 500 });
    }

    return json({ success: true, files: result.files });
  } catch (error) {
    return json({ error: 'Failed to list files' }, { status: 500 });
  }
};