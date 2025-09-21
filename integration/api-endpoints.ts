// api-endpoints.ts - Complete SvelteKit API routes for your app

// src/routes/api/storage/upload/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { RAGStorageClient } from '$lib/storage-client';

const storageClient = new RAGStorageClient({
  projectId: '439974099982',
  bucketName: 'your-rag-bucket-name'
});

export const POST: RequestHandler = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    if (!file || !userId) {
      return json({ error: 'Missing file or userId' }, { status: 400 });
    }

    await storageClient.createUserFolder(userId);
    const result = await storageClient.uploadFile(userId, file);

    if (!result.success) {
      return json({ error: result.error }, { status: 500 });
    }

    return json({ success: true, fileId: result.fileId, path: result.filePath });
  } catch (error) {
    return json({ error: 'Upload failed' }, { status: 500 });
  }
};

// src/routes/api/storage/list/+server.ts
export const GET: RequestHandler = async ({ url }) => {
  try {
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return json({ error: 'Missing userId' }, { status: 400 });
    }

    const result = await storageClient.listUserFiles(userId);

    if (!result.success) {
      return json({ error: result.error }, { status: 500 });
    }

    return json({ success: true, files: result.files });
  } catch (error) {
    return json({ error: 'Failed to list files' }, { status: 500 });
  }
};

// src/routes/api/storage/delete/+server.ts
export const DELETE: RequestHandler = async ({ request }) => {
  try {
    const { userId, fileName } = await request.json();

    if (!userId || !fileName) {
      return json({ error: 'Missing userId or fileName' }, { status: 400 });
    }

    const result = await storageClient.deleteFile(userId, fileName);

    if (!result.success) {
      return json({ error: result.error }, { status: 500 });
    }

    return json({ success: true });
  } catch (error) {
    return json({ error: 'Delete failed' }, { status: 500 });
  }
};