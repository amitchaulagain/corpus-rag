import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MultiProviderService } from '$lib/multi-provider-service';
import { requirePermission } from '$lib/auth-middleware';
import { getDB } from '$lib/db/mongodb';
import { JobModel } from '$lib/models/job';
import { TokenService } from '$lib/services/token-service';
import { ObjectId } from 'mongodb';

const multiProvider = new MultiProviderService();
const TOKEN_COST_RESUME = TokenService.TOKEN_COSTS.resumeTailoring;

export const POST: RequestHandler = async (event) => {
  try {
    // Check authentication and permission
    const auth = await requirePermission(event, 'resume');

    const requestBody = await event.request.json();
    const {
      job_id,
      job_details,
      resume_text,
      useAi,
      prompt,
      platform = 'other',
      job_title,
      company,
      platform_job_id
    } = requestBody;

    // Validate required fields
    if (!job_id || !job_details || !resume_text || !useAi) {
      return json(
        {
          success: false,
          error: 'Missing required fields: job_id, job_details, resume_text, useAi are required'
        },
        { status: 400 }
      );
    }

    // Check token balance before processing
    const tokenService = await TokenService.create();
    const tokenCheck = await tokenService.checkTokens(
      new ObjectId(auth.user._id),
      TOKEN_COST_RESUME
    );

    if (!tokenCheck.hasEnoughTokens) {
      return json(
        {
          success: false,
          error: 'Insufficient tokens',
          tokenInfo: {
            currentBalance: tokenCheck.currentBalance,
            requiredTokens: tokenCheck.requiredTokens,
            remainingAfter: tokenCheck.remainingAfter
          },
          purchaseUrl: '/plans'
        },
        { status: 402 } // 402 Payment Required
      );
    }

    const startTime = Date.now();

    // Build the full prompt for AI
    // Use user's custom prompt if provided, otherwise use default
    let fullPrompt = '';

    if (prompt) {
      // User provided their own prompt - use it as the main instruction
      fullPrompt = `${prompt}

JOB DESCRIPTION:
${typeof job_details === 'string' ? job_details : JSON.stringify(job_details, null, 2)}`;
    } else {
      // Fallback to default prompt
      fullPrompt = `Create a tailored resume for this position: ${typeof job_details === 'string' ? job_details : JSON.stringify(job_details, null, 2)}

Using my background and experience:
- Tailor the resume to match the job requirements
- Highlight relevant skills and experiences
- Use keywords from the job posting
- Format professionally with clear sections
- Keep it concise and impactful
- Include relevant technical skills and tools
- Show quantifiable achievements where possible

Please format as a complete resume with sections for:
- Contact Information (use placeholder data)
- Professional Summary
- Work Experience
- Skills
- Education
- Additional relevant sections as needed`;
    }

    // Query the AI provider with resume text
    const result = await multiProvider.querySingle(
      auth.user.email, // Use actual user email
      fullPrompt,
      useAi,
      resume_text
    );

    if (!result.success) {
      return json(
        {
          success: false,
          error: result.error || 'Resume generation failed'
        },
        { status: 500 }
      );
    }

    const processingTime = Date.now() - startTime;
    const meta = result.metadata;
    const tokensUsed = meta?.tokensUsed ?? result.tokensUsed ?? 0;
    const costUsd = (typeof meta?.cost === 'object' && meta?.cost != null && 'usd' in meta.cost)
      ? (meta.cost as { usd: number }).usd
      : (typeof result.cost === 'number' ? result.cost : 0);
    const inputTokens = meta?.inputTokens;
    const outputTokens = meta?.outputTokens;

    // Track this job and API call in database
    try {
      const db = await getDB();
      const jobModel = new JobModel(db);
      const userId = new ObjectId(auth.user._id);

      let jobRecord = platform_job_id
        ? await jobModel.findByPlatformId(userId, platform, platform_job_id)
        : null;

      if (!jobRecord && platform_job_id) {
        jobRecord = await jobModel.create({
          userId,
          platform,
          platformJobId: platform_job_id,
          title: job_title || 'Unknown Position',
          company: company || 'Unknown Company',
          description: typeof job_details === 'string' ? job_details : JSON.stringify(job_details),
          status: 'pending'
        });
      }

      if (jobRecord) {
        // Deduct tokens after successful generation
        const tokenDeduction = await tokenService.deductTokens(
          new ObjectId(auth.user._id),
          TOKEN_COST_RESUME,
          {
            jobId: jobRecord._id,
            endpoint: '/api/resume',
            aiProvider: useAi,
            description: `Resume tailoring for ${company || 'job'} - ${job_title || job_id}`
          }
        );

        if (!tokenDeduction.success) {
          console.error('Token deduction failed after successful generation:', tokenDeduction);
        }

        const apiCallRecord = {
          timestamp: new Date(),
          endpoint: '/api/resume',
          aiProvider: useAi,
          request: {
            prompt,
            jobDetails: job_details,
            resumeText: resume_text
          },
          response: {
            success: true,
            data: result.answer
          },
          tokensUsed,
          inputTokens,
          outputTokens,
          cost: costUsd,
          processingTime
        };

        if (!jobRecord.application) {
          await jobModel.createApplication(jobRecord._id!, {
            status: 'pending',
            tailoredResume: result.answer,
            apiCalls: [apiCallRecord],
            automationLogs: []
          });
        } else {
          await jobModel.addApiCall(jobRecord._id!, apiCallRecord);
          await jobModel.updateApplication(jobRecord._id!, {
            tailoredResume: result.answer
          });
        }
      } else {
        // Deduct tokens even if no job record
        const tokenDeduction = await tokenService.deductTokens(
          new ObjectId(auth.user._id),
          TOKEN_COST_RESUME,
          {
            endpoint: '/api/resume',
            aiProvider: useAi,
            description: `Resume tailoring for ${company || 'job'} - ${job_title || job_id}`
          }
        );

        if (!tokenDeduction.success) {
          console.error('Token deduction failed after successful generation:', tokenDeduction);
        }
      }
    } catch (trackingError) {
      console.error('Job tracking error:', trackingError);
    }

    // Get final token balance
    const finalBalance = await tokenService.getBalance(new ObjectId(auth.user._id));

    // Return resume, job_id, and token usage info (for clients to save and send to job-applications)
    return json({
      resume: result.answer,
      job_id,
      tokensUsed: TOKEN_COST_RESUME,
      actualTokensUsed: tokensUsed,
      inputTokens,
      outputTokens,
      remainingBalance: finalBalance
    });

  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: error instanceof Error && error.message.includes('Permission') ? 403 :
               error instanceof Error && error.message.includes('Authentication') ? 401 : 500 }
    );
  }
};
