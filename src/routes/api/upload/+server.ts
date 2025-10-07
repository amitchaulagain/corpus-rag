import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { LocalFileStorage } from '$lib/local-storage';

const storage = new LocalFileStorage('./data/uploads');

// POST /api/upload - Upload file locally
export const POST: RequestHandler = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    if (!file || !userId) {
      return json({ success: false, error: 'Missing file or userId' }, { status: 400 });
    }

    // Only allow TXT files
    if (!file.name.endsWith('.txt')) {
      return json(
        { success: false, error: 'Only .txt files are allowed' },
        { status: 400 }
      );
    }

    const filePath = await storage.saveFile(userId, file);

    // Read the text content
    const buffer = await file.arrayBuffer();
    const textContent = new TextDecoder().decode(buffer);

    return json({
      success: true,
      filename: file.name,
      path: filePath,
      content: textContent
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      },
      { status: 500 }
    );
  }
};

// GET /api/upload - List user's uploaded files or get file content
export const GET: RequestHandler = async ({ url }) => {
  try {
    const userId = url.searchParams.get('userId');
    const filename = url.searchParams.get('filename');

    if (!userId) {
      return json({ success: false, error: 'Missing userId' }, { status: 400 });
    }

    // If filename is provided, return file content
    if (filename) {
      const content = await storage.getFileContent(userId, filename);
      return json({
        success: true,
        filename,
        content
      });
    }

    // Otherwise list files
    const files = await storage.listFiles(userId);

    return json({
      success: true,
      files: files.map((filename) => ({
        name: filename,
        type: 'txt'
      }))
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load files'
      },
      { status: 500 }
    );
  }
};

// DELETE /api/upload - Delete a file
export const DELETE: RequestHandler = async ({ request }) => {
  try {
    const { userId, filename } = await request.json();

    if (!userId || !filename) {
      return json({ success: false, error: 'Missing userId or filename' }, { status: 400 });
    }

    await storage.deleteFile(userId, filename);

    return json({ success: true });
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed'
      },
      { status: 500 }
    );
  }
};
