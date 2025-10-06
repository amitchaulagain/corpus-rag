import { error, json } from '@sveltejs/kit';
import fs from 'fs/promises';
import path from 'path';

const PROMPTS_DIR = 'src/lib/prompts';
const DEFAULT_PROMPT_FILE = path.join(PROMPTS_DIR, 'employer-questions-default.txt');

// Ensure the prompts directory exists
await fs.mkdir(PROMPTS_DIR, { recursive: true });

// Default prompt content
const DEFAULT_PROMPT_CONTENT = `For each of these employer questions, analyze the question and my resume/background, then return ONLY a JSON array with the recommended responses.

Response Format:
- For "select" questions: single number (e.g., 2)
- For "checkbox" questions: array of numbers (e.g., [0,3,7])

Example: If Q1 is select (recommend option 3), Q2 is checkbox (recommend options 1,4), Q3 is select (recommend option 2):
Return: [3, [1,4], 2]

Rules:
- Return ONLY the array, no explanations or text
- Use 0-based indexing (first option = 0, second = 1, etc.)
- Array length must match number of questions
- Select questions = single number, checkbox questions = array of numbers
- Consider my actual experience and background from resume
- Choose answers that position me as the ideal candidate

Questions: [Questions List]`;

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
