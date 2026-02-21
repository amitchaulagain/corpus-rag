export const SUPPORTED_DOCUMENT_EXTENSIONS = ['.doc', '.docx', '.pdf'] as const;

export type SupportedDocumentExtension = (typeof SUPPORTED_DOCUMENT_EXTENSIONS)[number];

export const SUPPORTED_DOCUMENT_MIME_TYPES = new Set<string>([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf'
]);

export function getFileExtension(filename: string): string {
  const lower = String(filename || '').trim().toLowerCase();
  const index = lower.lastIndexOf('.');
  return index >= 0 ? lower.slice(index) : '';
}

export function isSupportedDocumentExtension(filename: string): filename is `${string}${SupportedDocumentExtension}` {
  const extension = getFileExtension(filename);
  return (SUPPORTED_DOCUMENT_EXTENSIONS as readonly string[]).includes(extension);
}

export function assertSupportedDocumentExtension(filename: string): asserts filename is `${string}${SupportedDocumentExtension}` {
  if (!isSupportedDocumentExtension(filename)) {
    throw new Error('Unsupported file type. Only .doc, .docx, and .pdf files are allowed.');
  }
}

