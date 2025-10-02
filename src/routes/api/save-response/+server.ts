import { error, json } from '@sveltejs/kit';
import fs from 'fs/promises';
import path from 'path';

const RESPONSES_DIR = 'generated-responses';

// Ensure the responses directory exists
await fs.mkdir(RESPONSES_DIR, { recursive: true });

function sanitizeFilename(str: string): string {
  return str.replace(/[^a-z0-9-_]/gi, '_').toLowerCase();
}

function generateFilename(type: string, company: string, title: string): string {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const sanitizedCompany = sanitizeFilename(company);
  const sanitizedTitle = sanitizeFilename(title).slice(0, 30); // limit length
  return `${type}-${sanitizedCompany}-${sanitizedTitle}-${timestamp}.json`;
}

export async function POST({ request }) {
  try {
    const { type, company, title, response: responseData, jobFilename } = await request.json();

    if (!type || !company || !title || !responseData) {
      throw error(400, 'Missing required fields: type, company, title, response');
    }

    const filename = generateFilename(type, company, title);
    const filePath = path.join(RESPONSES_DIR, filename);

    const data = {
      type,
      company,
      title,
      jobFilename,
      generatedAt: new Date().toISOString(),
      response: responseData
    };

    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');

    return json({ success: true, filename });
  } catch (e) {
    console.error('Failed to save response:', e);
    throw error(500, 'Failed to save response');
  }
}

export async function GET({ url }) {
  try {
    const type = url.searchParams.get('type');
    const jobFilename = url.searchParams.get('jobFilename');

    if (!type || !jobFilename) {
      throw error(400, 'Missing required parameters: type, jobFilename');
    }

    // Read all files in the directory
    const files = await fs.readdir(RESPONSES_DIR);

    // Filter files by type and find the most recent one for this job
    const matchingFiles = [];
    for (const file of files) {
      if (file.startsWith(type + '-') && file.endsWith('.json')) {
        const filePath = path.join(RESPONSES_DIR, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        if (data.jobFilename === jobFilename) {
          matchingFiles.push({ file, data, generatedAt: new Date(data.generatedAt) });
        }
      }
    }

    if (matchingFiles.length === 0) {
      return json({ success: false, message: 'No saved response found' });
    }

    // Sort by date and get the most recent
    matchingFiles.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
    const latest = matchingFiles[0];

    return json({ success: true, data: latest.data });
  } catch (e) {
    console.error('Failed to load response:', e);
    throw error(500, 'Failed to load response');
  }
}
