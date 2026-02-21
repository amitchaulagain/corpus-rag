import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isSupportedDocumentExtension } from '$lib/document-formats';
import { extractTextFromDocument } from '$lib/services/document-text-extractor';

// POST /api/extract-document - Extract text only, no storage side effects
export const POST: RequestHandler = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return json({ success: false, error: 'Missing file' }, { status: 400 });
    }
    if (!isSupportedDocumentExtension(file.name)) {
      return json(
        { success: false, error: 'Only .doc, .docx, and .pdf files are allowed' },
        { status: 400 }
      );
    }

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

    if (!textContent.trim()) {
      return json(
        { success: false, error: 'Could not extract readable text from uploaded file.' },
        { status: 400 }
      );
    }

    return json({
      success: true,
      filename: file.name,
      content: textContent
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Document extraction failed'
      },
      { status: 500 }
    );
  }
};
