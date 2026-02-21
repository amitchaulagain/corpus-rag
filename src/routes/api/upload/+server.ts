import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { LocalFileStorage } from '$lib/local-storage';
import { getDB } from '$lib/db/mongodb';
import { UserModel } from '$lib/models/user';
import { IngestionService } from '$lib/services/ingestion-service';
import {
  getFileExtension,
  isSupportedDocumentExtension
} from '$lib/document-formats';
import { extractTextFromDocument } from '$lib/services/document-text-extractor';

const storage = new LocalFileStorage('./data/uploads');

function toDocumentType(filename: string): 'doc' | 'docx' | 'pdf' | 'other' {
  const extension = getFileExtension(filename);
  if (extension === '.doc') return 'doc';
  if (extension === '.docx') return 'docx';
  if (extension === '.pdf') return 'pdf';
  return 'other';
}

// POST /api/upload - Upload file locally
export const POST: RequestHandler = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    if (!file || !userId) {
      return json({ success: false, error: 'Missing file or userId' }, { status: 400 });
    }

    if (!isSupportedDocumentExtension(file.name)) {
      return json(
        { success: false, error: 'Only .doc, .docx, and .pdf files are allowed' },
        { status: 400 }
      );
    }

    const filePath = await storage.saveFile(userId, file);

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    let textContent = '';
    try {
      textContent = await extractTextFromDocument(file.name, fileBuffer);
    } catch {
      return json(
        {
          success: false,
          error: `Unable to read ${file.name}. Please upload a valid .doc, .docx, or .pdf file.`
        },
        { status: 400 }
      );
    }
    if (!textContent) {
      return json(
        { success: false, error: 'Could not extract readable text from uploaded file.' },
        { status: 400 }
      );
    }

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
          mimeType: file.type || undefined
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
      if (!isSupportedDocumentExtension(filename)) {
        return json({
          success: false,
          error: 'Unsupported file type. Only .doc, .docx, and .pdf files are supported.'
        }, { status: 400 });
      }

      const fileBuffer = await storage.getFileBuffer(userId, filename);
      let content = '';
      try {
        content = await extractTextFromDocument(filename, fileBuffer);
      } catch {
        return json({
          success: false,
          error: `Unable to read ${filename}. Please re-upload a valid .doc, .docx, or .pdf file.`
        }, { status: 400 });
      }
      console.log('✅ Document text extracted:', content.length, 'characters');
      
      return json({
        success: true,
        filename,
        content
      });
    }

    // Otherwise list files
    const files = (await storage.listFiles(userId))
      .filter((filename) => isSupportedDocumentExtension(filename));

    return json({
      success: true,
      files: files.map((filename) => ({
        name: filename,
        type: toDocumentType(filename)
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
