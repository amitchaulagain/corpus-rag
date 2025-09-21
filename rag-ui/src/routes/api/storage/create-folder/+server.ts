import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { RAGStorageClient } from '$lib/storage-client';
import { GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_BUCKET_NAME } from '$env/static/private';

const storage = new RAGStorageClient({
  projectId: GOOGLE_CLOUD_PROJECT_ID,
  bucketName: GOOGLE_CLOUD_BUCKET_NAME
});

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return json({ error: 'Missing userId' }, { status: 400 });
    }

    // Create user folder
    const result = await storage.createUserFolder(userId);

    if (!result.success) {
      return json({ error: result.error }, { status: 500 });
    }

    return json({
      success: true,
      message: `Folder created for user: ${userId}`,
      folderPath: result.folderPath
    });

  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Failed to create folder' },
      { status: 500 }
    );
  }
};