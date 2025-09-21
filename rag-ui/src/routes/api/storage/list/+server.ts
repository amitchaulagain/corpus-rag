import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { RAGStorageClient } from '$lib/storage-client';
import { GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_BUCKET_NAME } from '$env/static/private';

const storage = new RAGStorageClient({
  projectId: GOOGLE_CLOUD_PROJECT_ID,
  bucketName: GOOGLE_CLOUD_BUCKET_NAME
});

export const GET: RequestHandler = async ({ url }) => {
  try {
    const userId = url.searchParams.get('userId');

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