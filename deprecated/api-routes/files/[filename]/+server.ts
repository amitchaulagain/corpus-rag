// Individual File Operations

import type { RequestHandler } from './$types';
import { RAGStorageClient } from '$lib/storage-client';
import { CloudVertexSyncService } from '$lib/sync-service';
import { GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_BUCKET_NAME, GOOGLE_CLOUD_API_KEY } from '$env/static/private';
import { authenticateRequest, handleApiRequest, requireScope, handleOptions, addCorsHeaders } from '$lib/api-utils.js';

const storage = new RAGStorageClient({
  projectId: GOOGLE_CLOUD_PROJECT_ID,
  bucketName: GOOGLE_CLOUD_BUCKET_NAME
});

const syncService = new CloudVertexSyncService({
  projectId: GOOGLE_CLOUD_PROJECT_ID,
  bucketName: GOOGLE_CLOUD_BUCKET_NAME,
  location: 'us-east4',
  apiKey: GOOGLE_CLOUD_API_KEY
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

    // Check if preview is requested
    const preview = event.url.searchParams.get('preview') === 'true';

    let fileData: any = {
      id: file.fileId || file.name,
      name: file.name,
      size: file.size,
      mimeType: file.mimeType || 'application/octet-stream',
      userId,
      fileId: file.fileId,
      fullPath: file.fullPath,
      created: file.created,
      downloadUrl: `gs://${GOOGLE_CLOUD_BUCKET_NAME}/${file.fullPath}` // GCS URL for reference
    };

    // Add content preview if requested
    if (preview) {
      const contentResult = await storage.getFileContent(userId, filename);
      if (contentResult.success) {
        fileData.preview = {
          content: contentResult.content,
          contentType: contentResult.contentType
        };
      } else {
        fileData.preview = {
          error: contentResult.error
        };
      }
    }

    return addCorsHeaders(new Response(JSON.stringify({
      success: true,
      data: fileData
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
    const result = await syncService.deleteAndSync(userId, filename);

    if (!result.success) {
      throw new Error(result.error || 'Delete and sync failed');
    }

    return {
      deleted: true,
      filename,
      syncResult: result.syncResult
    };
  });

  return addCorsHeaders(response);
};

// PATCH /api/files/[filename] - Update file content with sync
export const PATCH: RequestHandler = async (event) => {
  const auth = await authenticateRequest(event);
  if (auth instanceof Response) {
    return addCorsHeaders(auth);
  }

  if (!requireScope(auth, 'files:write')) {
    return addCorsHeaders(new Response(JSON.stringify({ success: false, error: 'Insufficient permissions' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  const response = await handleApiRequest(async () => {
    const userId = event.url.searchParams.get('userId') || auth.user.id;
    const filename = event.params.filename;

    if (!filename) {
      throw new Error('Filename is required');
    }

    const requestBody = await event.request.json();
    const { content } = requestBody;

    if (typeof content !== 'string') {
      throw new Error('Content is required and must be a string');
    }

    const result = await syncService.updateAndSync(userId, filename, content);

    if (!result.success) {
      throw new Error(result.error || 'Update and sync failed');
    }

    return {
      message: 'File updated successfully',
      filename,
      syncResult: result.syncResult
    };
  });

  return addCorsHeaders(response);
};