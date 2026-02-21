import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { assertSupportedDocumentExtension, getFileExtension } from '$lib/document-formats';

function normalizeExtractedText(input: string): string {
  return String(input || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .trim();
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfParseModule = await import('pdf-parse');
  const pdfParse = (pdfParseModule as unknown as { pdf?: (dataBuffer: Buffer) => Promise<{ text?: string }> }).pdf;
  if (typeof pdfParse !== 'function') {
    throw new Error('PDF parser is unavailable');
  }
  const result = await pdfParse(buffer);
  return normalizeExtractedText(result.text || '');
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return normalizeExtractedText(result.value || '');
}

async function extractDocText(buffer: Buffer): Promise<string> {
  const tempName = `upload-${crypto.randomUUID()}.doc`;
  const tempPath = path.join(os.tmpdir(), tempName);

  await fs.writeFile(tempPath, buffer);
  try {
    const wordExtractorModule = await import('word-extractor');
    const WordExtractor = (wordExtractorModule as unknown as { default?: new () => any }).default ?? (wordExtractorModule as unknown as new () => any);
    const extractor = new WordExtractor();
    const extracted = await extractor.extract(tempPath);
    return normalizeExtractedText(extracted?.getBody?.() || '');
  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }
}

export async function extractTextFromDocument(fileName: string, buffer: Buffer): Promise<string> {
  assertSupportedDocumentExtension(fileName);
  const extension = getFileExtension(fileName);

  if (extension === '.pdf') return extractPdfText(buffer);
  if (extension === '.docx') return extractDocxText(buffer);
  if (extension === '.doc') return extractDocText(buffer);

  throw new Error('Unsupported file type. Only .doc, .docx, and .pdf files are allowed.');
}

