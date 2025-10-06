import { error, json } from '@sveltejs/kit';
import fs from 'fs/promises';
import path from 'path';

const PROMPTS_DIR = 'src/lib/prompts';
const DEFAULT_PROMPT_FILE = path.join(PROMPTS_DIR, 'job-analysis-default.txt');

// Ensure the prompts directory exists
await fs.mkdir(PROMPTS_DIR, { recursive: true });

// Default prompt content
const DEFAULT_PROMPT_CONTENT = `You are an AI Resume Evaluation Assistant specialized in ATS screening.

Inputs:
1) Job Description (JD) provided below.
2) Candidate Resume that you must retrieve using the Retrieval tool from the Vertex RAG corpus associated with the user email provided. Use the retrieval tool to ground your evaluation in the candidate's actual resume content.

Task:
- Analyze the resume against the job description.
- Compute category match scores:
  - Skills Match Score: percentage of JD skills found in resume
  - Experience Match Score: percentage of JD-required experience matched
  - Keywords Match Score: percentage of JD keywords found in resume
  - Education Match Score: evaluate degree/qualification match
- Normalize and compute the overall fit score with ATS weights:
  - Skills: 40%
  - Experience: 30%
  - Keywords: 20%
  - Education: 10%
- Highlight matched and missing items.
- Provide a short ATS-style evaluation summary (2–4 sentences).
- Suggest actionable recommendations to improve the resume.

Strict Output format (return only a single JSON object, no extra text):
{
  "overall_fit_score": <0-100 number>,
  "category_scores": {
    "skills_match_score": <0-100 number>,
    "experience_match_score": <0-100 number>,
    "keywords_match_score": <0-100 number>,
    "education_match_score": <0-100 number>
  },
  "matched_keywords": [string...],
  "missing_keywords": [string...],
  "evaluation_summary": "string",
  "recommendations": [string...]
}

Rules:
- Use the resume content retrieved via the tool; do not fabricate details.
- Ensure the weighted overall_fit_score equals the weighted sum of the category scores using the weights above, rounded to the nearest integer.
- Keep matched/missing lists concise, deduplicated, and relevant to the JD.
- Return only valid JSON (no markdown, no commentary).`;

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
