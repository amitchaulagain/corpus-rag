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
    
    const { type, jobDetails, questions, userEmail, customPrompt, enhancementFocus, filename, jobId, jobTitle } = requestBody;
    
    console.log('Extracted values:');
    console.log('- type:', type);
    console.log('- jobDetails:', jobDetails);
    console.log('- jobDetails type:', typeof jobDetails);
    console.log('- userEmail:', userEmail);
    console.log('- filename:', filename);
    console.log('- jobId:', jobId);
    console.log('- jobTitle:', jobTitle);
    console.log('=========================');

    if (!type || !userEmail) {
      throw new Error('Type and user email are required');
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
        prompt = `You are a professional resume analyst with deep expertise in Applicant Tracking Systems (ATS), keyword optimization, and job-market alignment. 

Analyze my resume against this job posting and provide comprehensive enhancement recommendations:

Job Details: ${JSON.stringify(jobDetails, null, 2)}

## Your Analysis Should Include:

### 1. **RAG Analysis Output**
- **Important Keywords**: Extract all critical keywords from the job description
- **Missing Skills**: Identify skills mentioned in the job that are absent from my resume
- **Skills to Add**: Recommend specific skills to include for better ATS optimization
- **Resume Fit Score**: Provide detailed breakdown by categories:
  * Skills Match (0-100%)
  * Experience Relevance (0-100%) 
  * Format Compliance (0-100%)
  * Keyword Density (0-100%)
  * Overall Fit Score (0-100%)

### 2. **Resume Enhancement Instructions**
Following the professional resume enhancement guidelines:

**PRESERVE IDENTITY**: Maintain my original professional tone, structure, and personal branding
**INCORPORATE MISSING SKILLS**: Seamlessly integrate missing/recommended skills into relevant sections
**OPTIMIZE FOR ATS**: Ensure formatting, phrasing, and keyword usage align with ATS best practices
**BOOST FIT SCORE**: Improve fit score across all categories without fabricating information
**NATURAL INTEGRATION**: Contextually relevant additions, not keyword stuffing

### 3. **Specific Improvements**
For each section requiring enhancement:
- **Section**: (Summary, Skills, Experience, Education, etc.)
- **Original Text**: Current content from my resume
- **Enhanced Version**: Improved version with explanations
- **Reason**: Why this change improves ATS compliance and job fit
- **Impact Level**: High/Medium/Low based on expected improvement

### 4. **ATS Keyword Analysis**
- **Keywords Present**: List keywords from job description already in my resume
- **Keywords Added**: New keywords integrated naturally
- **Keywords Optimized**: Existing keywords improved for better ATS scanning
- **Keyword Density**: Optimal distribution across resume sections

### 5. **Enhanced Resume**
Provide the complete enhanced resume that is:
- ATS-optimized and keyword-rich
- Customized for this specific job
- Free from identity tampering
- Improved across all scoring categories
- Professional and natural in tone

### 6. **Enhancement Focus: ${focusDescription}**
Tailor recommendations based on selected focus:
- **ATS Optimization**: Keyword density, formatting, ATS-friendly structure, technical requirements
- **Skills Matching**: Highlight relevant technical and soft skills, demonstrate proficiency levels
- **Keyword Enhancement**: Industry-specific terminology, buzzwords, and job-relevant phrases
- **Experience Boost**: Quantify achievements, use action verbs, show measurable impact

Provide specific, actionable enhancements with clear before/after comparisons and measurable improvements.`;
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
        userId: userEmail,
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