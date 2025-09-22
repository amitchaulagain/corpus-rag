// API endpoint for manually syncing cloud storage files to Vertex AI
import { json } from '@sveltejs/kit';
import { RAGStorageClient } from '$lib/storage-client.js';
import { VertexRAGClient } from '$lib/rag-client.js';
import { GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_BUCKET_NAME } from '$env/static/private';
import type { RequestHandler } from './$types.js';

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
    const { userId } = await request.json();

    if (!userId) {
      return json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    console.log(`🔄 Starting manual sync for user: ${userId}`);

    // 1. List all files in user's cloud storage
    const filesResult = await storage.listUserFiles(userId);
    if (!filesResult.success) {
      return json({ success: false, error: `Failed to list files: ${filesResult.error}` }, { status: 500 });
    }

    const files = filesResult.files || [];
    if (files.length === 0) {
      return json({
        success: true,
        message: `No files found for user ${userId}`,
        importedCount: 0
      });
    }

    console.log(`📁 Found ${files.length} files for user ${userId}`);

    // 2. Import all files to Vertex AI
    const cloudStorageUris = files.map(file => file.fileId);

    const importResult = await rag.importFiles({
      userId,
      cloudStorageUris
    });

    if (!importResult.success) {
      return json({ success: false, error: `Import failed: ${importResult.error}` }, { status: 500 });
    }

    console.log(`✅ Manual sync completed for user ${userId}`);

    return json({
      success: true,
      message: `Successfully started import of ${files.length} files for user ${userId}`,
      operationId: importResult.operationId,
      importedCount: files.length,
      files: files.map(f => f.name)
    });

  } catch (error) {
    console.error('Manual sync error:', error);
    return json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
};