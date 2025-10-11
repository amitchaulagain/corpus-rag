// Jobs API endpoint
import type { RequestHandler } from './$types';
import { authenticateRequest, handleApiRequest, requireScope, handleOptions, addCorsHeaders } from '$lib/api-utils.js';
import { json } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';

const JOBS_DIR = path.resolve(process.cwd(), 'src/jobs');

// Handle preflight OPTIONS requests
export const OPTIONS: RequestHandler = () => {
  return handleOptions();
};

// GET /api/jobs - List all job files
export const GET: RequestHandler = async (event) => {
  // Internal UI endpoint - no auth required (just reading local files)
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

          // Create a preview from job details
          let preview = '';
          if (content.details) {
            // Extract a meaningful preview from the details
            const details = content.details.replace(/\n+/g, ' ').trim();
            // Find the first substantial paragraph after the header info
            const lines = details.split(/[.\n]/).filter(line => line.trim().length > 50);
            preview = lines[0]?.trim() || details.substring(0, 150);
            if (preview.length >= 150) {
              preview = preview.substring(0, 150) + '...';
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
            preview,
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

  return response;
};

// POST /api/jobs - Create a new job
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { company, title, location, description } = body;

    if (!company || !title || !description) {
      return json({
        success: false,
        error: 'Missing required fields: company, title, and description are required'
      }, { status: 400 });
    }

    // Create filename from company and title
    const sanitizedCompany = company.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const sanitizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const timestamp = Date.now();
    const filename = `${sanitizedCompany}_${sanitizedTitle}_${timestamp}.json`;
    const filePath = path.join(JOBS_DIR, filename);

    // Create job object
    const jobData = {
      company,
      title,
      location: location || '',
      details: description,
      raw_title: title,
      jobId: `custom_${timestamp}`,
      createdAt: new Date().toISOString()
    };

    // Ensure jobs directory exists
    if (!fs.existsSync(JOBS_DIR)) {
      fs.mkdirSync(JOBS_DIR, { recursive: true });
    }

    // Write job file
    fs.writeFileSync(filePath, JSON.stringify(jobData, null, 2), 'utf8');

    return json({
      success: true,
      filename,
      message: 'Job created successfully'
    });
  } catch (error: any) {
    console.error('Error creating job:', error);
    return json({
      success: false,
      error: error.message || 'Failed to create job'
    }, { status: 500 });
  }
};