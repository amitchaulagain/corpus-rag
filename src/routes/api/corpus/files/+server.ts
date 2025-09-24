// Corpus Files Management

import type { RequestHandler } from './$types';
import { VertexRAGClient } from '$lib/rag-client';
import { VertexCorpusManager } from '$lib/corpus-manager';
import { GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_API_KEY } from '$env/static/private';
import { authenticateRequest, handleApiRequest, requireScope, handleOptions, addCorsHeaders } from '$lib/api-utils.js';

const rag = new VertexRAGClient({
  projectId: GOOGLE_CLOUD_PROJECT_ID,
  location: 'us-east4',
  apiKey: GOOGLE_CLOUD_API_KEY
});

const corpus = new VertexCorpusManager({
  projectId: GOOGLE_CLOUD_PROJECT_ID,
  location: 'us-east4'
});

// Handle preflight OPTIONS requests
export const OPTIONS: RequestHandler = () => {
  return handleOptions();
};

// GET /api/corpus/files - List files in user's corpus
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

    // Get user's corpus
    const corpusResult = await corpus.getUserCorpus(userId);
    if (!corpusResult.success) {
      throw new Error(corpusResult.error || 'Failed to get corpus');
    }

    if (!corpusResult.exists) {
      return { files: [], corpusId: corpusResult.corpusId };
    }

    // List files in corpus
    const filesResult = await rag.listCorpusFiles(corpusResult.corpusId!);
    if (!filesResult.success) {
      throw new Error(filesResult.error || 'Failed to list corpus files');
    }

    const files = (filesResult.files || []).map(file => ({
      id: file.name,
      name: file.name,
      state: file.state,
      sizeBytes: file.sizeBytes,
      createTime: file.createTime,
      gcsSource: file.gcsSource,
      problemMessage: file.problemMessage
    }));

    return {
      files,
      corpusId: corpusResult.corpusId,
      count: files.length
    };
  });

  return addCorsHeaders(response);
};