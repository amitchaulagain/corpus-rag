export function formatFileSize(bytes: number | string | undefined): string {
  if (!bytes) return '';

  const size = typeof bytes === 'string' ? parseInt(bytes) : bytes;
  if (size === 0) return '0 Bytes';

  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(size) / Math.log(1024));
  return Math.round((size / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
}

export function extractFolderIdFromUrl(url: string): string {
  if (url.includes('drive.google.com')) {
    return url.split('/').find((part, index, array) =>
      array[index - 1] === 'folders'
    )?.split('?')[0] || url;
  }
  return url;
}