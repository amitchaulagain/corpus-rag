// Individual Job File API endpoint
import type { RequestHandler } from './$types';
import { authenticateRequest, handleApiRequest, requireScope, handleOptions, addCorsHeaders } from '$lib/api-utils.js';
import fs from 'fs';
import path from 'path';

const JOBS_DIR = path.resolve(process.cwd(), 'src/jobs');

// Handle preflight OPTIONS requests
export const OPTIONS: RequestHandler = () => {
  return handleOptions();
};

// GET /api/jobs/[filename] - Get specific job file content
export const GET: RequestHandler = async (event) => {
  // Internal UI endpoint - no auth required (just reading local files)
  const filename = event.params.filename;
  if (!filename) {
    return new Response(JSON.stringify({ success: false, error: 'Filename is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const response = await handleApiRequest(async () => {
    const filePath = path.join(JOBS_DIR, filename);

    // Security check - ensure file is within jobs directory
    if (!filePath.startsWith(JOBS_DIR) || !filename.endsWith('.json')) {
      throw new Error('Invalid file path');
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error('Job file not found');
    }

    try {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const stats = fs.statSync(filePath);

      return {
        filename,
        content,
        lastModified: stats.mtime,
        size: stats.size
      };
    } catch (error) {
      throw new Error('Could not parse job file: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  });

  return response;
};