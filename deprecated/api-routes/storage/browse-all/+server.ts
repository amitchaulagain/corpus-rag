// API endpoint for browsing all files and folders in cloud storage
import { json } from '@sveltejs/kit';
import { RAGStorageClient } from '$lib/storage-client.js';
import { GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_BUCKET_NAME } from '$env/static/private';
import type { RequestHandler } from './$types.js';

const storage = new RAGStorageClient({
  projectId: GOOGLE_CLOUD_PROJECT_ID,
  bucketName: GOOGLE_CLOUD_BUCKET_NAME
});

export const GET: RequestHandler = async ({ url }) => {
  try {
    const prefix = url.searchParams.get('prefix') || '';
    const delimiter = url.searchParams.get('delimiter') || '/';

    console.log(`🔍 Browsing cloud storage with prefix: "${prefix}"`);

    // Get the bucket directly to browse all files and folders
    const bucket = storage['bucket']; // Access private bucket property

    const [files, , apiResponse] = await bucket.getFiles({
      prefix: prefix,
      delimiter: delimiter,
      includeTrailingDelimiter: true
    });

    // Extract folders from prefixes
    const folders = apiResponse.prefixes || [];

    // Process files
    const fileList = files.map(file => ({
      name: file.name.split('/').pop() || file.name,
      fullPath: file.name,
      size: file.metadata.size,
      contentType: file.metadata.contentType,
      created: file.metadata.timeCreated,
      updated: file.metadata.updated,
      fileId: `gs://${GOOGLE_CLOUD_BUCKET_NAME}/${file.name}`,
      isFolder: false
    }));

    // Process folders
    const folderList = folders.map(folder => ({
      name: folder.replace(prefix, '').replace('/', ''),
      fullPath: folder,
      size: null,
      contentType: 'folder',
      created: null,
      updated: null,
      fileId: null,
      isFolder: true
    }));

    // Combine and sort
    const allItems = [...folderList, ...fileList].sort((a, b) => {
      // Folders first, then files
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });

    return json({
      success: true,
      items: allItems,
      currentPath: prefix,
      bucketName: GOOGLE_CLOUD_BUCKET_NAME,
      totalItems: allItems.length
    });

  } catch (error) {
    console.error('Browse storage error:', error);
    return json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
};