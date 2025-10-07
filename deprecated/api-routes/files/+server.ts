// Consolidated Files API Endpoint

import type { RequestHandler } from './$types';
import { RAGStorageClient } from '$lib/storage-client';
import { VertexRAGClient } from '$lib/rag-client';
import { CloudVertexSyncService } from '$lib/sync-service';
import { GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_BUCKET_NAME, GOOGLE_CLOUD_API_KEY } from '$env/static/private';
import { authenticateRequest, handleApiRequest, requireScope, handleOptions, addCorsHeaders, validators, validationError } from '$lib/api-utils.js';

const storage = new RAGStorageClient({
  projectId: GOOGLE_CLOUD_PROJECT_ID,
  bucketName: GOOGLE_CLOUD_BUCKET_NAME
});

const rag = new VertexRAGClient({
  projectId: GOOGLE_CLOUD_PROJECT_ID,
  location: 'us-east4',
  apiKey: GOOGLE_CLOUD_API_KEY
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

// GET /api/files - List user's files
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

    return { files, count: files.length };
  });

  return addCorsHeaders(response);
};

// POST /api/files - Upload file
export const POST: RequestHandler = async (event) => {
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
    const formData = await event.request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string || auth.user.id;
    const replaceExisting = formData.get('replaceExisting') === 'true';

    if (!file) {
      throw new Error('Missing file');
    }

    // Check if user has reached file limit (allow up to 2 files)
    if (!replaceExisting) {
      const existingFiles = await storage.listUserFiles(userId);
      if (existingFiles.success && existingFiles.files && existingFiles.files.length >= 2) {
        throw new Error('Maximum 2 files allowed. Delete a file first or use replaceExisting=true to overwrite.');
      }
    }

    // Create user folder if it doesn't exist
    await storage.createUserFolder(userId);

    // Upload and auto-sync using the sync service
    const fileName = `${file.name}`;
    const result = await syncService.uploadAndSync(userId, file, fileName);

    if (!result.success) {
      throw new Error(result.error || 'Upload and sync failed');
    }

    return {
      file: result.file,
      syncResult: result.syncResult
    };
  });

  return addCorsHeaders(response);
};

