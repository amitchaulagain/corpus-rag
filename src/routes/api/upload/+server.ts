import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { LocalFileStorage } from '$lib/local-storage';
import fs from 'fs/promises';

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
      let content: string = '';
      
      // Handle different file types
      if (filename.endsWith('.pdf')) {
        // For PDF files, try to read from text-cache first
        try {
          const cacheDir = './data/text-cache';
          const cachedTextPath = `${cacheDir}/${userId}/${filename}.txt`;
          
          console.log('Checking for cached PDF text at:', cachedTextPath);
          
          try {
            const cachedContent = await fs.readFile(cachedTextPath, 'utf-8');
            if (cachedContent && cachedContent.trim()) {
              content = cachedContent;
              console.log('✅ PDF text loaded from cache:', content.length, 'characters');
            } else {
              throw new Error('Cached content is empty');
            }
          } catch (cacheError) {
            // If cache doesn't exist, try to parse PDF directly
            console.log('No cache found, attempting PDF parsing...');
            
            const { createRequire } = await import('module');
            const require = createRequire(import.meta.url);
            const pdfParse = require('pdf-parse');
            
            const filePath = storage.getFilePath(userId, filename);
            const dataBuffer = await fs.readFile(filePath);
            const pdfData = await pdfParse(dataBuffer);
            content = pdfData.text;
            
            // Cache the extracted text for future use
            await fs.mkdir(`${cacheDir}/${userId}`, { recursive: true });
            await fs.writeFile(cachedTextPath, content, 'utf-8');
            
            console.log('✅ PDF text extracted and cached:', content.length, 'characters');
          }
        } catch (error: any) {
          console.error('❌ Failed to parse PDF:', error);
          return json({ 
            success: false, 
            error: `Failed to extract text from PDF: ${error.message}. Please upload a .txt file instead.` 
          }, { status: 500 });
        }
      } else if (filename.endsWith('.txt')) {
        // Read text file directly
        content = await storage.getFileContent(userId, filename);
        console.log('✅ TXT file read:', content.length, 'characters');
      } else {
        return json({ 
          success: false, 
          error: 'Unsupported file type. Only .txt and .pdf files are supported.' 
        }, { status: 400 });
      }
      
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
        type: filename.endsWith('.pdf') ? 'pdf' : 'txt'
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
