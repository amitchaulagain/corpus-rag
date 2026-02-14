// AI Generation API endpoint
import type { RequestHandler } from './$types';
import { authenticateRequest, handleApiRequest, requireScope, handleOptions, addCorsHeaders } from '$lib/api-utils.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { MultiProviderService } from '$lib/multi-provider-service';
import { getDB } from '$lib/db/mongodb';
import { UserModel } from '$lib/models/user';
import { RetrievalService } from '$lib/services/retrieval-service';
import { RAG_CONFIG } from '$lib/rag-config';

const multiProvider = new MultiProviderService();

// Handle preflight OPTIONS requests
export const OPTIONS: RequestHandler = () => {
  return handleOptions();
};

// POST /api/generate - Generate cover letter or employer answers using AI
export const POST: RequestHandler = async (event) => {
  // Note: This endpoint is used by the internal UI, so we don't require API key authentication
  // If external API access is needed, consider adding optional authentication
  
  const response = await handleApiRequest(async () => {
    const requestBody = await event.request.json();
    console.log('=== GENERATE API DEBUG ===');
    console.log('Raw request body:', JSON.stringify(requestBody, null, 2));
    
    const { type, jobDetails, details, questions, userEmail, customPrompt, enhancementFocus, filename, jobId, jobTitle, prompt: userPrompt, resumeText, useRag = true, retrievalConfig, profileId = 'default' } = requestBody;
    
    console.log('Extracted values:');
    console.log('- type:', type);
    console.log('- jobDetails:', jobDetails);
    console.log('- jobDetails type:', typeof jobDetails);
    console.log('- userEmail:', userEmail);
    console.log('- resumeText:', resumeText ? `✓ ${resumeText.length} characters` : '✗ not provided');
    console.log('- enhancementFocus:', enhancementFocus);
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
      
      // Include both job details and resume text in context
      analysisContext = `Job Details:\n${typeof jobDetails === 'string' ? jobDetails : JSON.stringify(jobDetails)}\n\nOriginal Resume:\n${resumeText || '[Resume will be loaded from user uploads]'}`;
      
      console.log('>>> Resume Enhancement Context Created:');
      console.log('>>> Resume text length:', resumeText ? resumeText.length : 0);
      console.log('>>> Context preview:', analysisContext.substring(0, 300) + '...');

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

    // Default provider (can be made configurable later)
    const providerId = 'deepseek-chat';
    let finalQuestion = analysisContext ? `${analysisContext}\n\n${prompt}` : prompt;
    let retrievalStats: Record<string, unknown> = {};
    let evidence: Array<Record<string, unknown>> = [];
    let warning: string | undefined;
    let contextSnapshotId: string | undefined;

    // Make resume_enhancement retrieval-first while preserving response contract.
    if (type === 'resume_enhancement' && useRag !== false && RAG_CONFIG.enabled && userEmail) {
      try {
        const db = await getDB();
        const userModel = new UserModel(db);
        const user = await userModel.findByEmail(userEmail);

        if (user?._id) {
          const retrievalService = new RetrievalService(db);
          const retrieval = await retrievalService.retrieve(
            user._id,
            `Resume enhancement for ${jobTitle || ''}\nFocus: ${enhancementFocus || 'general'}\n${typeof jobDetails === 'string' ? jobDetails : JSON.stringify(jobDetails)}`,
            {
              profileId,
              jobId,
              topK: retrievalConfig?.topK,
              initialK: retrievalConfig?.initialK,
              maxContextTokens: retrievalConfig?.maxContextTokens
            }
          );

          const contextBlock = retrieval.chunks
            .map((c, index) => `[${index + 1}] (score=${c.score.toFixed(3)}, docType=${c.docType})\n${c.text}`)
            .join('\n\n');

          retrievalStats = {
            ...retrieval.stats,
            topK: retrievalConfig?.topK ?? RAG_CONFIG.topK
          };
          evidence = retrieval.chunks.map((c) => ({
            chunkId: c.chunkId,
            docId: c.docId,
            type: 'rag_chunk',
            score: Number(c.score.toFixed(4)),
            snippet: c.text.length > 260 ? `${c.text.slice(0, 260)}...` : c.text,
            reason: 'Retrieved for resume enhancement',
            docType: c.docType
          }));

          if (contextBlock.trim().length > 0) {
            contextSnapshotId = crypto
              .createHash('sha256')
              .update(JSON.stringify({ userEmail, jobId, enhancementFocus, contextBlock }))
              .digest('hex');
            finalQuestion = `RETRIEVED EVIDENCE (USE THIS FIRST):\n${contextBlock}\n\n${finalQuestion}`;
          } else {
            warning = 'RAG enabled but no indexed chunks found. Fallback prompting used.';
          }
        }
      } catch (retrievalError) {
        warning = `RAG retrieval failed, fallback used: ${retrievalError instanceof Error ? retrievalError.message : 'unknown error'}`;
      }
    }

    const providerResult = await multiProvider.querySingle(
      userEmail || 'anonymous',
      finalQuestion,
      providerId,
      contextSnapshotId ? undefined : resumeText,
      contextSnapshotId
        ? {
            prebuiltPrompt: finalQuestion,
            disableAutoDocuments: true,
            contextSnapshotId,
            retrievalMetadata: {
              retrievalStats,
              evidence
            }
          }
        : undefined
    );

    if (!providerResult.success) {
      throw new Error(`AI generation failed: ${providerResult.error || 'Unknown error'}`);
    }

    const answer = providerResult.answer;

    if (!answer) {
      throw new Error('AI response is empty or invalid');
    }

    return {
      type,
      generatedText: answer,
      prompt: prompt.substring(0, 200) + '...', // Truncated prompt for reference
      retrievalStats,
      evidence,
      warning
    };
  });

  return addCorsHeaders(response);
};