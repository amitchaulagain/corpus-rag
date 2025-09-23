import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { RAGStorageClient } from '$lib/storage-client';
import { VertexRAGClient } from '$lib/rag-client';
import { GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_BUCKET_NAME, GOOGLE_CLOUD_API_KEY } from '$env/static/private';
import { authenticateRequest, handleApiRequest, requireScope, validators, validationError, authzError, handleOptions, addCorsHeaders } from '$lib/api-utils.js';

const storage = new RAGStorageClient({
  projectId: GOOGLE_CLOUD_PROJECT_ID,
  bucketName: GOOGLE_CLOUD_BUCKET_NAME
});

const rag = new VertexRAGClient({
  projectId: GOOGLE_CLOUD_PROJECT_ID,
  location: 'us-east4',
  apiKey: GOOGLE_CLOUD_API_KEY
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

    if (!requireScope(auth, 'files:write')) {
      return addCorsHeaders(new Response(JSON.stringify(authzError()), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }));
    }

    // Handle authenticated API request
    const response = await handleApiRequest(async () => {
      const formData = await event.request.formData();
      const file = formData.get('file') as File;
      const userId = formData.get('userId') as string || auth.user.id;
      const replaceExisting = formData.get('replaceExisting') === 'true';

      if (!file) {
        throw new Error('Missing file');
      }

      return await uploadFileInternal(userId, file, replaceExisting);
    });

    return addCorsHeaders(response);
  }

  // Legacy UI access - no authentication required for backward compatibility
  try {
    const formData = await event.request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    const replaceExisting = formData.get('replaceExisting') === 'true';

    if (!file || !userId) {
      return json({ error: 'Missing file or userId' }, { status: 400 });
    }

    const result = await uploadFileInternal(userId, file, replaceExisting);
    return json(result);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
};

// Internal upload function used by both UI and API
async function uploadFileInternal(userId: string, file: File, replaceExisting: boolean) {
  try {

    // Check if user already has a resume (unless replacing)
    if (!replaceExisting) {
      const existingFiles = await storage.listUserFiles(userId);
      if (existingFiles.success && existingFiles.files && existingFiles.files.length > 0) {
        throw new Error('You already have a resume uploaded. Please delete it first to upload a new one.');
      }
    }

    // Create user folder if it doesn't exist
    await storage.createUserFolder(userId);

    // Upload file with fixed name "resume.pdf" (or appropriate extension)
    const fileExtension = file.name.split('.').pop() || 'pdf';
    const fileName = `resume.${fileExtension}`;
    const result = await storage.uploadFile(userId, file, fileName);

    if (!result.success) {
      throw new Error(result.error || 'Upload failed');
    }

    // Automatically import the uploaded file to the user's RAG corpus
    let importResult = null;
    if (result.fileId) {
      try {
        console.log(`🔄 Starting auto-import for user ${userId} with file: ${result.fileId}`);

        importResult = await rag.importFiles({
          userId,
          cloudStorageUris: [result.fileId]
        });

        if (!importResult.success) {
          console.warn('File uploaded but RAG import failed:', importResult.error);

          // If import failed due to invalid corpus, try to create a new one
          if (importResult.error?.includes('404') || importResult.error?.includes('not found')) {
            console.log('🔧 Corpus not found, attempting to create/refresh corpus for user...');
            // Note: The RAG client should handle this automatically, but log for debugging
          }
        } else {
          console.log(`✅ Auto-import successful for user ${userId}`);
        }
      } catch (importError) {
        console.warn('File uploaded but RAG import failed:', importError);
      }
    }

    return {
      success: true,
      file: {
        id: result.fileId,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        userId,
        fileId: result.fileId,
        fullPath: result.filePath,
        created: new Date().toISOString()
      },
      ragImport: importResult ? {
        success: importResult.success,
        operationId: importResult.operationId,
        error: importResult.error
      } : null
    };

  } catch (error) {
    throw error;
  }
}