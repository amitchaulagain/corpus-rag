import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { RAGStorageClient } from '$lib/storage-client';
import { VertexRAGClient } from '$lib/rag-client';
import { GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_BUCKET_NAME } from '$env/static/private';

const storage = new RAGStorageClient({
  projectId: GOOGLE_CLOUD_PROJECT_ID,
  bucketName: GOOGLE_CLOUD_BUCKET_NAME
});

const rag = new VertexRAGClient({
  projectId: GOOGLE_CLOUD_PROJECT_ID,
  location: 'us-east4'
});

export const POST: RequestHandler = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    const replaceExisting = formData.get('replaceExisting') === 'true';

    if (!file || !userId) {
      return json({ error: 'Missing file or userId' }, { status: 400 });
    }

    // Check if user already has a resume (unless replacing)
    if (!replaceExisting) {
      const existingFiles = await storage.listUserFiles(userId);
      if (existingFiles.success && existingFiles.files && existingFiles.files.length > 0) {
        return json({
          error: 'You already have a resume uploaded. Please delete it first to upload a new one.',
          hasExistingFile: true
        }, { status: 400 });
      }
    }

    // Create user folder if it doesn't exist
    await storage.createUserFolder(userId);

    // Upload file with fixed name "resume.pdf" (or appropriate extension)
    const fileExtension = file.name.split('.').pop() || 'pdf';
    const fileName = `resume.${fileExtension}`;
    const result = await storage.uploadFile(userId, file, fileName);

    if (!result.success) {
      return json({ error: result.error }, { status: 500 });
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

    return json({
      success: true,
      file: {
        name: file.name,
        size: file.size,
        type: file.type,
        path: result.filePath,
        fileId: result.fileId
      },
      ragImport: importResult ? {
        success: importResult.success,
        operationId: importResult.operationId,
        error: importResult.error
      } : null
    });

  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
};