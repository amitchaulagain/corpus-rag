
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

function getDefaultPrompt(promptName: string): string {
  const defaults: Record<string, string> = {
    'cover-letter': `You are writing a cover letter that sounds authentically human - like someone who's genuinely interested in this specific role, not just mass-applying to jobs.

CONTEXT PROVIDED:
- My resume and professional background (use this to understand my voice, experience, and achievements)
- The job description for the role I'm applying to
- My name is explicitly provided with "Name:" - use this exact name for the signature, never use placeholders

YOUR MISSION:
Write a cover letter that will make a hiring manager stop scrolling and think "I need to interview this person."

CRITICAL RULES TO SOUND HUMAN (NOT AI):

1. **Opening** - NO generic greetings. Start with something that shows you actually read the job posting:
   - Reference a specific detail about the company, their product, or the role
   - If possible, mention why THIS role at THIS company (not just any job)
   - Keep it authentic - no "I am thrilled" or "I am excited to apply" clichés

2. **Body (2-3 paragraphs max, 250-300 words total)**:
   - Pick 2-3 SPECIFIC experiences from my resume that directly solve their problems
   - Use concrete examples with numbers/outcomes when possible (e.g., "reduced API latency by 40%" not "improved performance")
   - Match my writing style from the resume - if I'm technical and direct, write that way
   - Connect the dots: "You need X → I've done Y which proves I can deliver X"
   - NO buzzwords like "leverage," "synergize," "dynamic professional" - write like a real person talks

3. **Show genuine interest**:
   - If the job description mentions specific challenges, acknowledge them
   - Demonstrate you understand what success looks like in this role
   - Make it clear why I'd want THIS job (growth, tech stack, mission, team size, etc.)

4. **Closing**:
   - Skip "Thank you for your consideration" - it's filler
   - Simple call to action: "I'd love to discuss how my experience with [specific thing] could help with [their specific need]."
   - Sign off with my actual name from the context (look for "Name:" in the provided information)
   - Format: "Best,\\n[actual name]" or "Thanks,\\n[actual name]" - DO NOT write "[My Name]" literally

5. **Tone & Voice**:
   - Mirror MY personality from the resume (casual vs formal, concise vs detailed)
   - Write like you're explaining to a friend why you're a good fit
   - Use "I" statements but don't make every sentence about "I did this, I did that"
   - Vary sentence length - some short, some longer. Humans don't write in perfect patterns.
   - Use contractions where natural (I've, you're, they're) - robots don't

6. **What to AVOID** (dead giveaways of AI writing):
   - ❌ "I am writing to express my interest in..."
   - ❌ "Throughout my career..."
   - ❌ "I am confident that my skills and experience make me an ideal candidate"
   - ❌ Perfect parallel structure in every paragraph
   - ❌ Overly polished, corporate-speak language
   - ❌ Listing every qualification from the job description
   - ❌ Three perfectly balanced paragraphs of equal length

7. **LinkedIn Auto-Apply Context**:
   - This will be submitted through LinkedIn's application system
   - Keep formatting simple (no special characters, stick to plain text)
   - No "Attached please find my resume" - it's already uploaded
   - No need for full address header (Dear Hiring Manager is fine if no name)

STRUCTURE:
\`\`\`
[Greeting - use "Dear Hiring Manager" or name if found in job description]

[Opening hook - 1-2 sentences showing you read the JD and why this role]

[Paragraph 1: Your most relevant experience/achievement that matches their top need]

[Paragraph 2: Another key qualification or unique angle that sets you apart]

[Brief closing - why you're interested + simple CTA]

[Sign-off]
[Actual name from "Name:" field in context - DO NOT write placeholder text]
\`\`\`

FINAL CHECK BEFORE OUTPUT:
- Does this sound like a real person wrote it?
- Would you send this to a hiring manager if your career depended on it?
- Did you avoid all the cliché AI phrases?
- Is it under 350 words?
- Does it connect MY specific background to THEIR specific needs?

Now write the cover letter. Make it sound like ME, not a chatbot.`,
    'employer-questions': `For each of these employer questions, analyze the question and my resume/background, then return ONLY a JSON array with the recommended responses.

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

Questions: [Questions List]`,
    'job-analysis': `You are an ATS (Applicant Tracking System) analyzer. You will receive two documents:
1. resume
2. job description

Your task is to perform a comprehensive job fit analysis and return ONLY valid JSON - no explanations, no markdown code blocks, no extra text.

ANALYSIS STEPS:

Step 1: Extract TECHNICAL SKILLS ONLY from both documents
- Focus on: hard skills, tools, technologies, certifications, domain-specific competencies
- Exclude: soft skills, generic terms like "communication", "leadership", "teamwork"
- Examples vary by field:
  * Tech: Java, Python, React, AWS, Docker, SQL, Agile
  * Marketing: SEO, Google Analytics, CRM, A/B testing, Copywriting
  * Finance: Financial modeling, Excel, SAP, Risk analysis, GAAP
  * Design: Figma, Adobe Creative Suite, UI/UX, Prototyping

Step 2: Extract MEANINGFUL KEYWORDS from both documents
- Focus on: domain-specific terms, job-specific requirements, technical concepts, role-specific responsibilities
- Exclude: common filler words like "team", "work", "experience", "professional", "responsible for"
- Limit to max 20 most important keywords per document
- Examples vary by field:
  * Tech: "full-stack development", "microservices", "CI/CD pipeline", "API design"
  * Marketing: "content strategy", "campaign management", "customer acquisition", "brand positioning"
  * Finance: "financial reporting", "budget forecasting", "compliance", "portfolio management"

Step 3: Find matched and missing items
- matched skills: skills in BOTH resume and JD
- missing skills: skills in JD but NOT in resume
- matched_keywords: keywords in BOTH resume and JD
- missing_keywords: keywords in JD but NOT in resume

Step 4: Calculate match scores (0-100):
- Skills Match Score: (matched skills / total JD skills) * 100
- Experience Match Score: based on years and relevance of experience

Step 5: Calculate overall fit score using ATS weighting:
- Skills: 50%
- Experience: 30%
- Keywords: 20%

Step 6: Write evaluation summary (2-3 sentences) and 3-5 actionable recommendations

CRITICAL OUTPUT REQUIREMENTS:
1. Return ONLY the JSON object - no markdown, no code blocks, no explanations
2. Do NOT wrap in \`\`\`json or \`\`\`
3. Return valid, parseable JSON
4. All arrays must contain strings only
5. All scores must be integers 0-100

Output format (EXACT JSON structure - use underscores in keys, no spaces):
{
  "overall_fit_score": 0,
  "category_scores": {
    "skills_match_score": 0,
    "experience_match_score": 0
  },
  "skills_in_resume": [],
  "skills_in_jd": [],
  "matched_skills": [],
  "missing_skills": [],
  "keywords_in_resume": [],
  "keywords_in_jd": [],
  "matched_keywords": [],
  "missing_keywords": [],
  "evaluation_summary": "",
  "recommendations": []
}`,
    'resume-enhancement': `You are an expert resume optimizer and ATS specialist. I will provide you with a job description and my current resume. Your task is to enhance my resume to maximize ATS compatibility and appeal to hiring managers for this specific role.

Instructions:
1. Analyze the job description to identify:
   - Required and preferred skills
   - Key responsibilities and qualifications
   - Industry-specific keywords and terminology
   - Technical requirements and tools mentioned
   - Soft skills and competencies valued

2. Review my current resume to assess:
   - Relevant experiences that align with the role
   - Skills and achievements to emphasize
   - Gaps or weaknesses to address
   - Areas that need stronger impact statements
   - ATS optimization opportunities

3. Provide an enhanced resume that:
   - Incorporates relevant keywords naturally throughout
   - Reformats experience bullet points for maximum impact
   - Uses strong action verbs and quantifiable achievements
   - Aligns skills section with job requirements
   - Optimizes section headers for ATS parsing
   - Highlights transferable skills when applicable
   - Maintains truthfulness while maximizing presentation
   - Uses industry-standard formatting

4. Structure your output with:
   - Professional Summary (2-3 sentences tailored to this role)
   - Key Skills (prioritized based on job requirements)
   - Work Experience (enhanced bullet points with metrics)
   - Education and Certifications
   - Any relevant additional sections

5. ATS Optimization Guidelines:
   - Use standard section headers
   - Avoid tables, graphics, or complex formatting
   - Include exact keyword matches from job description
   - Use both acronyms and full terms (e.g., "AI (Artificial Intelligence)")
   - Ensure consistent date formatting

Focus on making the resume both ATS-friendly and compelling to human readers. Highlight achievements over responsibilities.`,
    'resume-comparison': `You are an expert resume analyst. I will provide you with a job description, my original resume, and an enhanced version of my resume. Your task is to create a detailed side-by-side comparison highlighting the improvements and changes made.

Instructions:
1. Analyze both resume versions against the job description to assess:
   - Keyword optimization improvements
   - ATS compatibility enhancements
   - Impact statement strengthening
   - Relevance to the specific role
   - Overall presentation improvements

2. Create a comprehensive comparison that includes:
   - Section-by-section analysis (Summary, Skills, Experience, etc.)
   - Specific changes made to each bullet point
   - Keywords added or optimized
   - Metrics and quantifiable achievements added
   - Formatting improvements for ATS parsing

3. For each major change, explain:
   - What was changed (Original → Enhanced)
   - Why it was changed
   - How it better aligns with the job requirements
   - Impact on ATS scoring (if applicable)

4. Structure your output as:
   - Executive Summary (overall improvements at a glance)
   - Detailed Comparison by Section:
     * Professional Summary
     * Key Skills
     * Work Experience (bullet-by-bullet)
     * Education & Certifications
   - ATS Optimization Score (Original vs Enhanced)
   - Key Improvements Summary (top 5-7 changes)
   - Recommendations (any additional suggestions)

5. Use clear formatting:
   - Use "ORIGINAL:" and "ENHANCED:" labels
   - Highlight keyword additions in **bold**
   - Mark quantifiable metrics with [METRIC]
   - Indicate ATS-critical changes with [ATS]

Provide actionable insights that help understand the value of each enhancement and how it improves candidacy for this specific role.`
  };

  return defaults[promptName] || '';
}

export async function GET({ params, url }) {
  const { promptName } = params;
  const filePath = await getPromptPath(promptName);
  const getDefault = url.searchParams.get('default') === 'true';

  if (getDefault) {
    return json({ content: getDefaultPrompt(promptName) });
  }

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const defaultContent = getDefaultPrompt(promptName);
    return json({ content, isModified: content !== defaultContent });
  } catch (e) {
    if (e.code === 'ENOENT') {
      const defaultContent = getDefaultPrompt(promptName);
      return json({ content: defaultContent, isModified: false });
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
