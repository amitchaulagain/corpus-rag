// Consolidated Corpus API Endpoint

import type { RequestHandler } from './$types';
import { VertexCorpusManager } from '$lib/corpus-manager';
import { VertexRAGClient } from '$lib/rag-client';
import { GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_API_KEY } from '$env/static/private';
import { authenticateRequest, handleApiRequest, requireScope, handleOptions, addCorsHeaders, validators, validationError } from '$lib/api-utils.js';

const corpus = new VertexCorpusManager({
  projectId: GOOGLE_CLOUD_PROJECT_ID,
  location: 'us-east4'
});

const rag = new VertexRAGClient({
  projectId: GOOGLE_CLOUD_PROJECT_ID,
  location: 'us-east4',
  apiKey: GOOGLE_CLOUD_API_KEY
});

// Handle preflight OPTIONS requests
export const OPTIONS: RequestHandler = () => {
  return handleOptions();
};

// GET /api/corpus - Get user's corpus information
export const GET: RequestHandler = async (event) => {
  const auth = await authenticateRequest(event);
  if (auth instanceof Response) {
    return addCorsHeaders(auth);
  }

  if (!requireScope(auth, 'corpus:read')) {
    return addCorsHeaders(new Response(JSON.stringify({ success: false, error: 'Insufficient permissions' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  const response = await handleApiRequest(async () => {
    const userId = event.url.searchParams.get('userId') || auth.user.id;

    // Get or create user corpus
    const result = await corpus.getUserCorpus(userId);

    if (!result.success) {
      throw new Error(result.error || 'Failed to get corpus');
    }

    // Get corpus files if corpus exists
    let files = [];
    if (result.exists && result.corpusId) {
      try {
        const filesResult = await rag.listCorpusFiles(result.corpusId);
        if (filesResult.success) {
          files = filesResult.files || [];
        }
      } catch (error) {
        console.warn('Failed to list corpus files:', error);
      }
    }

    return {
      corpusId: result.corpusId,
      userId,
      displayName: result.displayName,
      exists: result.exists,
      createTime: result.createTime,
      fileCount: files.length,
      files: files.map(file => ({
        id: file.name,
        name: file.name,
        state: file.state,
        sizeBytes: file.sizeBytes,
        createTime: file.createTime,
        gcsSource: file.gcsSource,
        problemMessage: file.problemMessage
      }))
    };
  });

  return addCorsHeaders(response);
};

// POST /api/corpus - Create or manage corpus
export const POST: RequestHandler = async (event) => {
  const auth = await authenticateRequest(event);
  if (auth instanceof Response) {
    return addCorsHeaders(auth);
  }

  if (!requireScope(auth, 'corpus:write')) {
    return addCorsHeaders(new Response(JSON.stringify({ success: false, error: 'Insufficient permissions' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  const requestBody = await event.request.json().catch(() => null);
  const validated = validators.corpusRequest(requestBody);

  if (!validated) {
    return addCorsHeaders(new Response(JSON.stringify(validationError('userId is required')), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  const response = await handleApiRequest(async () => {
    const userId = validated.userId || auth.user.id;

    // Handle different corpus operations based on action parameter
    const action = requestBody?.action || 'get_or_create';

    switch (action) {
      case 'get_or_create':
        const result = await corpus.getUserCorpus(userId);
        if (!result.success) {
          throw new Error(result.error || 'Failed to get or create corpus');
        }
        return {
          corpusId: result.corpusId,
          userId,
          exists: result.exists
        };

      case 'cleanup':
        const cleanupResult = await corpus.cleanupDuplicateCorpora(userId);
        if (!cleanupResult.success) {
          throw new Error(cleanupResult.error || 'Failed to cleanup corpora');
        }
        return {
          message: `Cleaned up ${cleanupResult.deletedCount} duplicate corpora`,
          deletedCount: cleanupResult.deletedCount
        };

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  });

  return addCorsHeaders(response);
};