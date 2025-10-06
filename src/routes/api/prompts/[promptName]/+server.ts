
import { error, json } from '@sveltejs/kit';
import fs from 'fs/promises';
import path from 'path';

const PROMPTS_DIR = 'src/lib/prompts';

// Ensure the prompts directory exists
await fs.mkdir(PROMPTS_DIR, { recursive: true });

async function getPromptPath(promptName: string): Promise<string> {
  if (!/^[a-zA-Z0-9-_]+$/.test(promptName)) {
    throw error(400, 'Invalid prompt name');
  }
  return path.join(PROMPTS_DIR, `${promptName}.txt`);
}

export async function GET({ params }) {
  const { promptName } = params;
  const filePath = await getPromptPath(promptName);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return json({ content });
  } catch (e) {
    if (e.code === 'ENOENT') {
      // Return default content if the file doesn't exist
      if (promptName === 'cover-letter') {
        return json({ content: `Write a compelling cover letter for this position: [Job Details]

Use my background from the resume and user info to:
- Address their specific pain points mentioned in the job posting
- Highlight 2-3 most relevant experiences
- Match their company tone/culture if discernible
- Keep it under 300 words
- End with a strong call to action

Please format as a professional cover letter with proper greeting and closing.` });
      } else if (promptName === 'employer-questions') {
        return json({ content: `For each of these employer questions, analyze the question and my resume/background, then return ONLY a JSON array with the recommended responses.

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

Questions: [Questions List]` });
      }
      return json({ content: '' });
    }
    throw error(500, 'Failed to read prompt');
  }
}

export async function POST({ params, request }) {
  const { promptName } = params;
  const { content } = await request.json();
  const filePath = await getPromptPath(promptName);

  try {
    // Avoid unnecessary writes to prevent dev server reload loops
    try {
      const existing = await fs.readFile(filePath, 'utf-8').catch(() => null);
      if (existing !== null && existing === content) {
        return json({ success: true, changed: false });
      }
    } catch {}

    await fs.writeFile(filePath, content, 'utf-8');
    return json({ success: true, changed: true });
  } catch (e) {
    throw error(500, 'Failed to save prompt');
  }
}
