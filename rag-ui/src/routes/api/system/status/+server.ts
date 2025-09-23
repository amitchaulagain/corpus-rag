// System Status and Health Check

import type { RequestHandler } from './$types';
import { RAGStorageClient } from '$lib/storage-client';
import { VertexRAGClient } from '$lib/rag-client';
import { GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_BUCKET_NAME, GOOGLE_CLOUD_API_KEY } from '$env/static/private';
import { authenticateRequest, handleApiRequest, requireScope, handleOptions, addCorsHeaders } from '$lib/api-utils.js';

const storage = new RAGStorageClient({
  projectId: GOOGLE_CLOUD_PROJECT_ID,
  bucketName: GOOGLE_CLOUD_BUCKET_NAME
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

// GET /api/system/status - Get system health status
export const GET: RequestHandler = async (event) => {
  // Allow public access to status endpoint for monitoring
  const authHeader = event.request.headers.get('Authorization');
  const hasApiKey = authHeader && authHeader.startsWith('Bearer ');

  if (hasApiKey) {
    const auth = await authenticateRequest(event);
    if (auth instanceof Response) {
      return addCorsHeaders(auth);
    }

    if (!requireScope(auth, 'system:status')) {
      return addCorsHeaders(new Response(JSON.stringify({ success: false, error: 'Insufficient permissions' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }));
    }
  }

  const response = await handleApiRequest(async () => {
    const startTime = Date.now();

    // Test storage service
    let storageStatus = 'healthy';
    try {
      // Try to list a dummy folder to test connectivity
      await storage.listFiles('health-check/', { maxResults: 1 });
    } catch (error) {
      console.warn('Storage health check failed:', error);
      storageStatus = 'degraded';
    }

    // Test Vertex AI service
    let vertexAIStatus = 'healthy';
    try {
      // Try to list corpora to test connectivity
      const result = await rag.listCorpora();
      if (!result.success) {
        vertexAIStatus = 'degraded';
      }
    } catch (error) {
      console.warn('Vertex AI health check failed:', error);
      vertexAIStatus = 'down';
    }

    // Determine overall status
    let overallStatus = 'healthy';
    if (storageStatus === 'down' || vertexAIStatus === 'down') {
      overallStatus = 'down';
    } else if (storageStatus === 'degraded' || vertexAIStatus === 'degraded') {
      overallStatus = 'degraded';
    }

    const uptime = process.uptime();
    const responseTime = Date.now() - startTime;

    return {
      status: overallStatus,
      version: '1.0.0',
      uptime,
      responseTime,
      services: {
        storage: storageStatus,
        vertexAI: vertexAIStatus,
        database: 'healthy' // Placeholder since we're not using a traditional database
      },
      environment: {
        projectId: GOOGLE_CLOUD_PROJECT_ID,
        region: 'us-east4',
        bucket: GOOGLE_CLOUD_BUCKET_NAME
      },
      timestamp: new Date().toISOString()
    };
  });

  return addCorsHeaders(response);
};