// RAG Operation Status Check

import type { RequestHandler } from './$types';
import { VertexRAGClient } from '$lib/rag-client';
import { GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_API_KEY } from '$env/static/private';
import { authenticateRequest, handleApiRequest, requireScope, handleOptions, addCorsHeaders } from '$lib/api-utils.js';

const rag = new VertexRAGClient({
  projectId: GOOGLE_CLOUD_PROJECT_ID,
  location: 'us-east4',
  apiKey: GOOGLE_CLOUD_API_KEY
});

// Handle preflight OPTIONS requests
export const OPTIONS: RequestHandler = () => {
  return handleOptions();
};

// GET /api/rag/operations/[operationId] - Check operation status
export const GET: RequestHandler = async (event) => {
  const auth = await authenticateRequest(event);
  if (auth instanceof Response) {
    return addCorsHeaders(auth);
  }

  if (!requireScope(auth, 'rag:import')) {
    return addCorsHeaders(new Response(JSON.stringify({ success: false, error: 'Insufficient permissions' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  const operationId = event.params.operationId;
  if (!operationId) {
    return addCorsHeaders(new Response(JSON.stringify({ success: false, error: 'Operation ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  const response = await handleApiRequest(async () => {
    const result = await rag.checkOperationStatus(operationId);

    if (!result.success) {
      throw new Error(result.error || 'Failed to check operation status');
    }

    return {
      operationId,
      done: result.operation?.done || false,
      progress: result.operation?.progress,
      error: result.operation?.error,
      result: result.operation?.result
    };
  });

  return addCorsHeaders(response);
};