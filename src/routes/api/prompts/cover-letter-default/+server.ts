import { error, json } from '@sveltejs/kit';
import fs from 'fs/promises';
import path from 'path';

const PROMPTS_DIR = 'src/lib/prompts';
const DEFAULT_PROMPT_FILE = path.join(PROMPTS_DIR, 'cover-letter-default.txt');

// Ensure the prompts directory exists
await fs.mkdir(PROMPTS_DIR, { recursive: true });

// Default prompt content
const DEFAULT_PROMPT_CONTENT = `Write a compelling cover letter for this position: [Job Details]

Use my background from the resume and user info to:
- Address their specific pain points mentioned in the job posting
- Highlight 2-3 most relevant experiences
- Match their company tone/culture if discernible
- Keep it under 300 words
- End with a strong call to action

Please format as a professional cover letter with proper greeting and closing.`;

export async function GET() {
  try {
    // Try to read the default prompt file
    let content;
    try {
      content = await fs.readFile(DEFAULT_PROMPT_FILE, 'utf-8');
    } catch (e) {
      // If file doesn't exist, create it with default content
      await fs.writeFile(DEFAULT_PROMPT_FILE, DEFAULT_PROMPT_CONTENT, 'utf-8');
      content = DEFAULT_PROMPT_CONTENT;
    }

    return json({ 
      content,
      isDefault: true,
      lastModified: new Date().toISOString()
    });
  } catch (e) {
    console.error('Failed to read default prompt:', e);
    return json({ 
      content: DEFAULT_PROMPT_CONTENT,
      isDefault: true,
      error: 'Using fallback default prompt'
    });
  }
}

export async function POST({ request }) {
  try {
    const { content } = await request.json();

    if (!content || typeof content !== 'string') {
      throw error(400, 'Content is required and must be a string');
    }

    // Save the new default prompt
    await fs.writeFile(DEFAULT_PROMPT_FILE, content, 'utf-8');

    return json({ 
      success: true, 
      message: 'Default prompt saved successfully',
      lastModified: new Date().toISOString()
    });
  } catch (e) {
    console.error('Failed to save default prompt:', e);
    throw error(500, 'Failed to save default prompt');
  }
}