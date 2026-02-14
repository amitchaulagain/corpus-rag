import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { LocalFileStorage } from '$lib/local-storage';
import { getDB } from '$lib/db/mongodb';
import { UserModel } from '$lib/models/user';
import { IngestionService } from '$lib/services/ingestion-service';

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

    // Allow only TXT files
    const fileExt = file.name.toLowerCase();
    if (!fileExt.endsWith('.txt')) {
      return json(
        { success: false, error: 'Only .txt files are allowed' },
        { status: 400 }
      );
    }

    const filePath = await storage.saveFile(userId, file);

    // Read text file content
    const buffer = await file.arrayBuffer();
    const textContent = new TextDecoder().decode(buffer);

    // Async RAG ingestion (non-blocking for upload UX)
    void (async () => {
      try {
        const db = await getDB();
        const userModel = new UserModel(db);
        const user = await userModel.findByEmail(userId);
        if (!user?._id) return;

        const ingestionService = new IngestionService(db);
        await ingestionService.ingestTextDocument({
          userId: user._id,
          profileId: 'default',
          title: file.name,
          docType: file.name.toLowerCase().includes('resume') ? 'resume' : 'other',
          source: 'upload',
          text: textContent,
          localPath: filePath,
          mimeType: file.type || 'text/plain'
        });
      } catch (ingestError) {
        console.error('RAG ingestion failed after upload:', ingestError);
      }
    })();

    return json({
      success: true,
      filename: file.name,
      path: filePath,
      content: textContent,
      ragIngestionQueued: true
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
      // Only support .txt files
      if (!filename.endsWith('.txt')) {
        return json({
          success: false,
          error: 'Unsupported file type. Only .txt files are supported.'
        }, { status: 400 });
      }

      // Read text file directly
      const content = await storage.getFileContent(userId, filename);
      console.log('✅ TXT file read:', content.length, 'characters');
      
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
