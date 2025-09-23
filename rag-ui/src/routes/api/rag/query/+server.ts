import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { VertexRAGClient } from '$lib/rag-client';
import { GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_API_KEY } from '$env/static/private';
import { authenticateRequest, handleApiRequest, requireScope, validators, validationError, handleOptions, addCorsHeaders } from '$lib/api-utils.js';

const rag = new VertexRAGClient({
  projectId: GOOGLE_CLOUD_PROJECT_ID,
  location: 'us-east4',
  apiKey: GOOGLE_CLOUD_API_KEY
  // No ragCorpusId - will be resolved per user
});

// Handle preflight OPTIONS requests
export const OPTIONS: RequestHandler = () => {
  return handleOptions();
};

export const POST: RequestHandler = async (event) => {
  // Check for API authentication for external access
  const authHeader = event.request.headers.get('Authorization');
  const hasApiKey = authHeader && authHeader.startsWith('Bearer ');

  if (hasApiKey) {
    // External API access - require authentication
    const auth = await authenticateRequest(event);
    if (auth instanceof Response) {
      return addCorsHeaders(auth);
    }

    if (!requireScope(auth, 'rag:query')) {
      return addCorsHeaders(new Response(JSON.stringify({ success: false, error: 'Insufficient permissions' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }));
    }

    // Handle authenticated API request
    const response = await handleApiRequest(async () => {
      const requestBody = await event.request.json().catch(() => null);
      const validated = validators.queryRequest(requestBody);

      if (!validated) {
        throw new Error('userId and question are required');
      }

      const userId = validated.userId || auth.user.id;
      const startTime = Date.now();

      const result = await rag.query({
        userId,
        question: validated.question,
        context: validated.context
      });

      if (!result.success) {
        throw new Error(result.error || 'Query failed');
      }

      const processingTime = Date.now() - startTime;

      return {
        answer: result.answer,
        sources: result.sources || [],
        processingTime,
        corpusId: result.corpusId || 'unknown'
      };
    });

    return addCorsHeaders(response);
  }

  // Legacy UI access - no authentication required for backward compatibility
  try {
    const { userId, question } = await event.request.json();

    if (!userId || !question) {
      return json({ error: 'Missing userId or question' }, { status: 400 });
    }

    const result = await rag.query({ userId, question });

    if (!result.success) {
      return json({ error: result.error }, { status: 500 });
    }

    return json({ success: true, answer: result.answer });
  } catch (error) {
    return json({ error: 'Query failed' }, { status: 500 });
  }
};