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