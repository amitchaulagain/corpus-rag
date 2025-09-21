import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { RAGStorageClient } from '$lib/storage-client';
import { GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_BUCKET_NAME } from '$env/static/private';

const storage = new RAGStorageClient({
  projectId: GOOGLE_CLOUD_PROJECT_ID,
  bucketName: GOOGLE_CLOUD_BUCKET_NAME
});

export const DELETE: RequestHandler = async ({ request }) => {
  try {
    const { userId, fileName } = await request.json();

    if (!userId || !fileName) {
      return json({ error: 'Missing userId or fileName' }, { status: 400 });
    }

    // Delete file
    const result = await storage.deleteFile(userId, fileName);

    if (!result.success) {
      return json({ error: result.error }, { status: 500 });
    }

    return json({
      success: true,
      message: 'Resume deleted successfully'
    });

  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Failed to delete file' },
      { status: 500 }
    );
  }
};