// src/routes/api/storage/+page.server.ts - SvelteKit API endpoints
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { RAGStorageClient } from '$lib/storage-client';

const storageClient = new RAGStorageClient({
  projectId: '439974099982',
  bucketName: 'your-rag-bucket-name', // Replace with your bucket name
  // keyFilename: '/path/to/service-account-key.json' // Optional
});

// POST /api/storage/upload
export const POST: RequestHandler = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    const customFileName = formData.get('fileName') as string | undefined;

    if (!file || !userId) {
      return json({ error: 'Missing file or userId' }, { status: 400 });
    }

    // Create user folder if it doesn't exist
    await storageClient.createUserFolder(userId);

    // Upload file
    const result = await storageClient.uploadFile(userId, file, customFileName);

    if (!result.success) {
      return json({ error: result.error }, { status: 500 });
    }

    return json({
      success: true,
      file: {
        name: file.name,
        size: file.size,
        type: file.type,
        path: result.filePath,
        fileId: result.fileId
      }
    });

  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
};