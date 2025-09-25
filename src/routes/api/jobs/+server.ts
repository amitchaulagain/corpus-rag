// Jobs API endpoint
import type { RequestHandler } from './$types';
import { authenticateRequest, handleApiRequest, requireScope, handleOptions, addCorsHeaders } from '$lib/api-utils.js';
import fs from 'fs';
import path from 'path';

const JOBS_DIR = '/home/wagle/corpus-rag/src/jobs';

// Handle preflight OPTIONS requests
export const OPTIONS: RequestHandler = () => {
  return handleOptions();
};

// GET /api/jobs - List all job files
export const GET: RequestHandler = async (event) => {
  const auth = await authenticateRequest(event);
  if (auth instanceof Response) {
    return addCorsHeaders(auth);
  }

  if (!requireScope(auth, 'files:read')) {
    return addCorsHeaders(new Response(JSON.stringify({ success: false, error: 'Insufficient permissions' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  const response = await handleApiRequest(async () => {
    // Read all JSON files from jobs directory
    const files = fs.readdirSync(JOBS_DIR)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(JOBS_DIR, file);
        const stats = fs.statSync(filePath);

        try {
          const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

          // Extract company name from filename or content
          let company = '';
          if (file.startsWith('employer_questions_')) {
            company = 'Employer Questions';
          } else {
            // Try to extract company from filename
            const parts = file.replace('.json', '').split('_');
            if (content.company) {
              company = content.company;
            } else if (parts.length > 1) {
              // Convert underscore separated to title case
              company = parts.slice(0, -1).map(part =>
                part.charAt(0).toUpperCase() + part.slice(1)
              ).join(' ');
            }
          }

          // Determine file type based on content
          let fileType = 'job';
          let hasQuestions = false;
          let hasJobDetails = false;

          if (file.startsWith('employer_questions_')) {
            fileType = 'questions-only';
            hasQuestions = true;
          } else {
            // Check if file has both job details and questions
            hasJobDetails = !!(content.details || content.title || content.raw_title);
            hasQuestions = !!(content.questions && content.questions.length > 0);

            if (hasJobDetails && hasQuestions) {
              fileType = 'job-with-questions';
            } else if (hasJobDetails) {
              fileType = 'job-only';
            } else if (hasQuestions) {
              fileType = 'questions-only';
            }
          }

          return {
            filename: file,
            company,
            title: content.title || content.raw_title || 'Unknown Position',
            location: content.location || '',
            jobId: content.jobId || '',
            type: fileType,
            hasQuestions,
            hasJobDetails,
            questionCount: content.questions ? content.questions.length : 0,
            lastModified: stats.mtime,
            size: stats.size
          };
        } catch (error) {
          console.error(`Error parsing job file ${file}:`, error);
          return {
            filename: file,
            company: 'Unknown',
            title: 'Error loading file',
            location: '',
            jobId: '',
            type: 'error',
            lastModified: stats.mtime,
            size: stats.size,
            error: 'Could not parse JSON'
          };
        }
      })
      .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    return {
      jobs: files,
      totalJobs: files.length
    };
  });

  return addCorsHeaders(response);
};