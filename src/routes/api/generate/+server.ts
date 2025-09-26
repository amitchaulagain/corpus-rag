// AI Generation API endpoint
import type { RequestHandler } from './$types';
import { authenticateRequest, handleApiRequest, requireScope, handleOptions, addCorsHeaders } from '$lib/api-utils.js';

// Handle preflight OPTIONS requests
export const OPTIONS: RequestHandler = () => {
  return handleOptions();
};

// POST /api/generate - Generate cover letter or employer answers using AI
export const POST: RequestHandler = async (event) => {
  const auth = await authenticateRequest(event);
  if (auth instanceof Response) {
    return addCorsHeaders(auth);
  }

  if (!requireScope(auth, 'rag:query')) {
    return addCorsHeaders(new Response(JSON.stringify({ success: false, error: 'Insufficient permissions' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  const response = await handleApiRequest(async () => {
    const requestBody = await event.request.json();
    const { type, jobDetails, questions, userEmail, customPrompt, enhancementFocus } = requestBody;

    if (!type || !userEmail) {
      throw new Error('Type and user email are required');
    }

    let prompt = '';

    if (type === 'cover_letter') {
      if (!jobDetails) {
        throw new Error('Job details are required for cover letter generation');
      }

      // Use custom prompt if provided, otherwise use default
      if (customPrompt) {
        prompt = `${customPrompt}

Job Details: ${JSON.stringify(jobDetails, null, 2)}`;
      } else {
        prompt = `Write a compelling cover letter for this position: ${JSON.stringify(jobDetails, null, 2)}

Use my background from the resume and user info to:
- Address their specific pain points mentioned in the job posting
- Highlight 2-3 most relevant experiences
- Match their company tone/culture if discernible
- Keep it under 300 words
- End with a strong call to action

Please format as a professional cover letter with proper greeting and closing.`;
      }

    } else if (type === 'employer_answers') {
      if (!questions || !Array.isArray(questions)) {
        throw new Error('Questions array is required for employer answers');
      }

      const questionsText = questions.map((q, index) =>
        `Question ${index + 1}: ${q.q}\nOptions: ${q.opts.join(', ')}`
      ).join('\n\n');

      // Use custom prompt if provided, otherwise use default
      if (customPrompt) {
        prompt = `${customPrompt}

Questions: ${questionsText}`;
      } else {
        prompt = `For each of these employer questions: ${questionsText}

Provide the best answer choice and a brief rationale. Consider:
- My actual experience level and background
- What the employer is really asking (subtext)
- Which answer positions me as the ideal candidate
- Consistency with my resume and cover letter

Format: Question → Recommended Answer → 2-sentence rationale

Please be specific about which option number (starting from 0) to select for each question.`;
      }

    } else if (type === 'job_analysis') {
      if (!jobDetails) {
        throw new Error('Job details are required for job analysis');
      }

      prompt = customPrompt || `Analyze this job description and my resume to provide a detailed fit analysis.

Job Details: ${JSON.stringify(jobDetails, null, 2)}

Please provide a comprehensive analysis including:

1. Overall fit score (0-100%)
2. Skill categories breakdown:
   - Technical Skills (programming languages, frameworks, tools)
   - Soft Skills (communication, leadership, teamwork)
   - Domain Knowledge (industry-specific expertise)
   - Certifications & Education
   - Experience Level

For each category, list:
- Required skills from the job
- Skills I have that match
- Skills I'm missing
- Category-specific fit score

3. Key insights:
   - Top 3 strongest matches
   - Top 3 areas for improvement
   - Specific recommendations to improve fit

4. ATS keyword analysis:
   - Important keywords from the job description
   - Keywords present in my resume
   - Missing keywords that should be added

Format the response as a detailed analysis with specific scores and actionable recommendations.`;

    } else if (type === 'resume_enhancement') {
      if (!jobDetails) {
        throw new Error('Job details are required for resume enhancement');
      }

      const focusDescription = enhancementFocus === 'ats' ? 'ATS Optimization' : 
                              enhancementFocus === 'skills' ? 'Skills Matching' :
                              enhancementFocus === 'keywords' ? 'Keyword Enhancement' :
                              enhancementFocus === 'experience' ? 'Experience Boost' : 'General Enhancement';

      prompt = customPrompt || `Enhance my resume for this specific job posting with focus on ${focusDescription}.

Job Details: ${JSON.stringify(jobDetails, null, 2)}

Please provide:

1. **Original vs Enhanced Fit Score**: Calculate fit scores before and after enhancement (0-100%)

2. **Specific Improvements**: For each section that needs enhancement, provide:
   - Section name (Summary, Experience, Skills, etc.)
   - Original text
   - Enhanced version
   - Reason for change
   - Impact level (high/medium/low)

3. **ATS Optimization**:
   - Keywords added for ATS scanning
   - Formatting improvements
   - Skills alignment with job requirements

4. **Enhanced Resume**: Complete enhanced resume text

Focus areas based on selection:
- ATS Optimization: Keyword density, formatting, ATS-friendly structure
- Skills Matching: Highlight relevant technical and soft skills
- Keyword Enhancement: Industry-specific terminology and buzzwords
- Experience Boost: Quantify achievements, use action verbs, show impact

Provide specific, actionable enhancements with clear before/after comparisons.`;

    } else if (type === 'resume_comparison') {
      if (!jobDetails) {
        throw new Error('Job details are required for resume comparison');
      }

      prompt = customPrompt || `Generate a detailed before/after comparison of my resume for this job posting.

Job Details: ${JSON.stringify(jobDetails, null, 2)}

Please provide:

1. **Original Resume Analysis**:
   - Current resume content from RAG system
   - Fit score for the job (0-100%)
   - Count of matching keywords
   - Key sections present

2. **Enhanced Resume**:
   - Optimized version tailored for this job
   - New fit score after improvements
   - Additional keywords incorporated
   - New/improved sections

3. **Detailed Changes**:
   - Section-by-section comparison
   - What was added, modified, or removed
   - Why each change was made
   - Impact level of each change

4. **Improvement Metrics**:
   - Specific areas improved (keywords, skills, experience descriptions)
   - Quantified improvements (% increase in keyword matches, etc.)
   - ATS optimization score improvement

5. **Highlighted Changes**:
   - Mark specific text additions with [ADDED: text]
   - Mark modifications with [CHANGED: old text → new text]
   - Mark removals with [REMOVED: text]

Focus on concrete, measurable improvements that will help with ATS systems and human reviewers.`;

    } else {
      throw new Error('Invalid generation type. Must be "cover_letter", "employer_answers", "job_analysis", "resume_enhancement", or "resume_comparison"');
    }

    // Call the RAG query endpoint to generate response
    const ragResponse = await fetch(`${event.url.origin}/api/rag/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': event.request.headers.get('Authorization') || ''
      },
      body: JSON.stringify({
        userId: userEmail,
        question: prompt,
        maxTokens: 2000,
        temperature: 0.7
      })
    });

    if (!ragResponse.ok) {
      const errorData = await ragResponse.text();
      throw new Error(`AI generation failed: ${ragResponse.status} - ${errorData}`);
    }

    const ragResult = await ragResponse.json();

    if (!ragResult.success) {
      throw new Error(`AI generation failed: ${ragResult.error}`);
    }

    // Handle both authenticated and legacy response structures
    const answer = ragResult.data ? ragResult.data.answer : ragResult.answer;

    if (!answer) {
      throw new Error('AI response is empty or invalid');
    }

    return {
      type,
      generatedText: answer,
      prompt: prompt.substring(0, 200) + '...' // Truncated prompt for reference
    };
  });

  return addCorsHeaders(response);
};