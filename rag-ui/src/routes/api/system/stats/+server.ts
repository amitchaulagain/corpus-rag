// System Usage Statistics

import type { RequestHandler } from './$types';
import { RAGStorageClient } from '$lib/storage-client';
import { VertexCorpusManager } from '$lib/corpus-manager';
import { GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_BUCKET_NAME, GOOGLE_CLOUD_API_KEY } from '$env/static/private';
import { authenticateRequest, handleApiRequest, requireScope, handleOptions, addCorsHeaders } from '$lib/api-utils.js';

const storage = new RAGStorageClient({
  projectId: GOOGLE_CLOUD_PROJECT_ID,
  bucketName: GOOGLE_CLOUD_BUCKET_NAME
});

const corpus = new VertexCorpusManager({
  projectId: GOOGLE_CLOUD_PROJECT_ID,
  location: 'us-east4'
});

// Handle preflight OPTIONS requests
export const OPTIONS: RequestHandler = () => {
  return handleOptions();
};

// GET /api/system/stats - Get usage statistics
export const GET: RequestHandler = async (event) => {
  const auth = await authenticateRequest(event);
  if (auth instanceof Response) {
    return addCorsHeaders(auth);
  }

  const response = await handleApiRequest(async () => {
    const userId = event.url.searchParams.get('userId') || auth.user.id;

    // Get user's files
    let filesUploaded = 0;
    let storageUsed = 0;
    try {
      const result = await storage.listUserFiles(userId);
      if (result.success && result.files) {
        filesUploaded = result.files.length;
        storageUsed = result.files.reduce((total, file) => {
          return total + (parseInt(file.size || '0') || 0);
        }, 0);
      }
    } catch (error) {
      console.warn('Failed to get storage stats:', error);
    }

    // Get user's corpus info
    let corpusExists = false;
    let corpusFileCount = 0;
    try {
      const result = await corpus.getUserCorpus(userId);
      if (result.success) {
        corpusExists = result.exists || false;
        // Note: Would need to implement file count retrieval from corpus
      }
    } catch (error) {
      console.warn('Failed to get corpus stats:', error);
    }

    // Mock query stats (would need to implement actual tracking)
    const queriesCount = 0; // Placeholder
    const lastActivity = new Date().toISOString(); // Placeholder

    return {
      userId,
      filesUploaded,
      storageUsed,
      queriesCount,
      lastActivity,
      corpus: {
        exists: corpusExists,
        fileCount: corpusFileCount
      },
      monthlyUsage: {
        uploads: filesUploaded, // Would need proper tracking
        queries: queriesCount, // Would need proper tracking
        storageUsed
      },
      limits: {
        maxFiles: 100, // Example limit
        maxStorageBytes: 1024 * 1024 * 1024, // 1GB example limit
        maxQueriesPerDay: 1000 // Example limit
      },
      timestamp: new Date().toISOString()
    };
  });

  return addCorsHeaders(response);
};