// Individual File Operations

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

// GET /api/files/[filename] - Download file
export const GET: RequestHandler = async (event) => {
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

  const filename = event.params.filename;
  const userId = event.url.searchParams.get('userId') || auth.user.id;

  if (!filename) {
    return addCorsHeaders(new Response(JSON.stringify({ success: false, error: 'Filename is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  try {
    // This would need to be implemented in the storage client
    // For now, return file metadata
    const result = await storage.listUserFiles(userId);
    if (!result.success) {
      throw new Error(result.error || 'Failed to access files');
    }

    const file = result.files?.find(f => f.name === filename);
    if (!file) {
      return addCorsHeaders(new Response(JSON.stringify({ success: false, error: 'File not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      }));
    }

    // Return file metadata (actual file download would require implementing download in storage client)
    return addCorsHeaders(new Response(JSON.stringify({
      success: true,
      data: {
        id: file.fileId || file.name,
        name: file.name,
        size: file.size,
        mimeType: file.mimeType || 'application/octet-stream',
        userId,
        fileId: file.fileId,
        fullPath: file.fullPath,
        created: file.created,
        downloadUrl: `gs://${GOOGLE_CLOUD_BUCKET_NAME}/${file.fullPath}` // GCS URL for reference
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));

  } catch (error) {
    return addCorsHeaders(new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get file'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }));
  }
};

// DELETE /api/files/[filename] - Delete file
export const DELETE: RequestHandler = async (event) => {
  const auth = await authenticateRequest(event);
  if (auth instanceof Response) {
    return addCorsHeaders(auth);
  }

  if (!requireScope(auth, 'files:delete')) {
    return addCorsHeaders(new Response(JSON.stringify({ success: false, error: 'Insufficient permissions' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  const filename = event.params.filename;
  const userId = event.url.searchParams.get('userId') || auth.user.id;

  if (!filename) {
    return addCorsHeaders(new Response(JSON.stringify({ success: false, error: 'Filename is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  const response = await handleApiRequest(async () => {
    const result = await storage.deleteFile(userId, filename);

    if (!result.success) {
      throw new Error(result.error || 'Failed to delete file');
    }

    return { deleted: true, filename };
  });

  return addCorsHeaders(response);
};