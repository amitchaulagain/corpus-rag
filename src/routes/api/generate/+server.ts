// AI Generation API endpoint
import type { RequestHandler } from './$types';
import { authenticateRequest, handleApiRequest, requireScope, handleOptions, addCorsHeaders } from '$lib/api-utils.js';
import fs from 'fs';
import path from 'path';

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
    console.log('=== GENERATE API DEBUG ===');
    console.log('Raw request body:', JSON.stringify(requestBody, null, 2));
    
    const { type, jobDetails, details, questions, userEmail, customPrompt, enhancementFocus, filename, jobId, jobTitle, prompt: userPrompt } = requestBody;
    
    console.log('Extracted values:');
    console.log('- type:', type);
    console.log('- jobDetails:', jobDetails);
    console.log('- jobDetails type:', typeof jobDetails);
    console.log('- userEmail:', userEmail);
    console.log('- filename:', filename);
    console.log('- jobId:', jobId);
    console.log('- jobTitle:', jobTitle);
    console.log('=========================');

    if (!type) {
      throw new Error('Type is required');
    }

    let prompt = '';
    let analysisContext: string | undefined = undefined;

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

      if (!userPrompt) {
        throw new Error('User prompt is required for employer answers');
      }

      const questionsText = questions.map((q, index) =>
        `Question ${index} - TYPE: ${q.type.toUpperCase()} - ${q.q}\nOptions: ${q.opts.join(', ')}`
      ).join('\n\n');

      // Use ONLY the user's textarea prompt, replace placeholders
      prompt = userPrompt.replace('[Questions List]', questionsText);

      if (details) {
        // If job description checkbox is checked, add it as context
        analysisContext = `Job Details:\n${details}`;
      }

    } else if (type === 'job_analysis') {
      let effectiveJobDetails = jobDetails;

      // Server-side fallback: if jobDetails missing, attempt to load from filename
      if (!effectiveJobDetails && filename) {
        try {
          const JOBS_DIR = '/Users/admin/extratech/corpus-rag/src/jobs';
          const filePath = path.join(JOBS_DIR, filename);
          if (fs.existsSync(filePath)) {
            const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            effectiveJobDetails = content;
            console.log('Loaded job details from filename on server');
          } else {
            console.warn('Filename provided but file not found:', filePath);
          }
        } catch (e) {
          console.error('Failed to load job details by filename:', e);
        }
      }

      // Fallback by jobId if provided
      if (!effectiveJobDetails && jobId) {
        try {
          const JOBS_DIR = '/Users/admin/extratech/corpus-rag/src/jobs';
          const files = fs.readdirSync(JOBS_DIR).filter((f) => f.endsWith('.json'));
          for (const f of files) {
            try {
              const content = JSON.parse(fs.readFileSync(path.join(JOBS_DIR, f), 'utf8'));
              if (content.jobId === jobId) {
                effectiveJobDetails = content;
                console.log('Loaded job details by jobId on server:', f);
                break;
              }
            } catch {}
          }
        } catch (e) {
          console.error('Failed to scan jobs by jobId:', e);
        }
      }

      // Fallback by title if provided
      if (!effectiveJobDetails && jobTitle) {
        try {
          const JOBS_DIR = '/Users/admin/extratech/corpus-rag/src/jobs';
          const files = fs.readdirSync(JOBS_DIR).filter((f) => f.endsWith('.json'));
          for (const f of files) {
            try {
              const content = JSON.parse(fs.readFileSync(path.join(JOBS_DIR, f), 'utf8'));
              if (content.title === jobTitle || content.raw_title?.includes(jobTitle)) {
                effectiveJobDetails = content;
                console.log('Loaded job details by title on server:', f);
                break;
              }
            } catch {}
          }
        } catch (e) {
          console.error('Failed to scan jobs by title:', e);
        }
      }

      // If jobDetails is a string, wrap as { details }
      if (typeof effectiveJobDetails === 'string') {
        effectiveJobDetails = { details: effectiveJobDetails } as any;
      }

      if (!effectiveJobDetails) {
        console.error('jobDetails is missing or null:', jobDetails);
        console.error('Full request body was:', requestBody);
        throw new Error('Job details are required for job analysis');
      }
      
      if (!(effectiveJobDetails as any).details && !(effectiveJobDetails as any).title) {
        console.error('jobDetails exists but missing details/title:', effectiveJobDetails);
        throw new Error('Job details must contain job description (details field) or title');
      }

      if (customPrompt) {
        prompt = `${customPrompt}

Job Details: ${JSON.stringify(effectiveJobDetails, null, 2)}\n`;
      } else {
        prompt = `Analyze this job description and my resume to provide a detailed fit analysis.

Job Details: ${JSON.stringify(effectiveJobDetails, null, 2)}

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
      }
      // Provide explicit context to RAG endpoint as well
      analysisContext = `Job Details:\n${typeof effectiveJobDetails === 'string' ? effectiveJobDetails : JSON.stringify(effectiveJobDetails)}`;

    } else if (type === 'resume_enhancement') {
      if (!jobDetails) {
        throw new Error('Job details are required for resume enhancement');
      }

      const focusDescription = enhancementFocus === 'ats' ? 'ATS Optimization' : 
                              enhancementFocus === 'skills' ? 'Skills Matching' :
                              enhancementFocus === 'keywords' ? 'Keyword Enhancement' :
                              enhancementFocus === 'experience' ? 'Experience Boost' : 'General Enhancement';

      if (customPrompt) {
        prompt = `${customPrompt}

Job Details: ${JSON.stringify(jobDetails, null, 2)}\n`;
      } else {
        prompt = `Enhance my resume for this specific job posting with focus on ${focusDescription}.

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
      }
      analysisContext = `Job Details:\n${typeof jobDetails === 'string' ? jobDetails : JSON.stringify(jobDetails)}`;

    } else if (type === 'resume_comparison') {
      if (!jobDetails) {
        throw new Error('Job details are required for resume comparison');
      }

      if (customPrompt) {
        prompt = `${customPrompt}

Job Details: ${JSON.stringify(jobDetails, null, 2)}\n`;
      } else {
        prompt = `Generate a detailed before/after comparison of my resume for this job posting.

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
      }
      analysisContext = `Job Details:\n${typeof jobDetails === 'string' ? jobDetails : JSON.stringify(jobDetails)}`;

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
        userId: userEmail || auth.user?.email || 'anonymous',
        question: prompt,
        context: analysisContext,
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