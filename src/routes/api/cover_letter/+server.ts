import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MultiProviderService } from '$lib/multi-provider-service';
import { requirePermission } from '$lib/auth-middleware';
import { jobService } from '$lib/db/job-service';

const multiProvider = new MultiProviderService();

export const POST: RequestHandler = async (event) => {
  try {
    // Check authentication and permission
    const auth = await requirePermission(event, 'cover_letter');

    const requestBody = await event.request.json();
    const {
      job_id,
      job_details,
      resume_text,
      useAi,
      prompt,
      platform = 'other',  // seek, linkedin, indeed, other
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
      fullPrompt = `Write a compelling cover letter for this position: ${typeof job_details === 'string' ? job_details : JSON.stringify(job_details, null, 2)}

Use my background from the resume to:
- Address their specific pain points mentioned in the job posting
- Highlight 2-3 most relevant experiences
- Match their company tone/culture if discernible
- Keep it under 300 words
- End with a strong call to action

Please format as a professional cover letter with proper greeting and closing.`;
    }

    // Query the AI provider with resume text
    const result = await multiProvider.querySingle(
      auth.user.email, // Use actual user email instead of 'external'
      fullPrompt,
      useAi,
      resume_text
    );

    if (!result.success) {
      return json(
        {
          success: false,
          error: result.error || 'Cover letter generation failed'
        },
        { status: 500 }
      );
    }

    const processingTime = Date.now() - startTime;

    // Track this job and API call in database
    try {
      // Find or create job record
      let jobRecord = platform_job_id
        ? await jobService.findJobByPlatformId(auth.user.id!, platform, platform_job_id)
        : null;

      if (!jobRecord && platform_job_id) {
        jobRecord = await jobService.createJob({
          userId: auth.user.id!,
          platform,
          platformJobId: platform_job_id,
          title: job_title || 'Unknown Position',
          company: company || 'Unknown Company',
          description: typeof job_details === 'string' ? job_details : JSON.stringify(job_details),
          status: 'pending'
        });
      }

      // Create or update job application record
      if (jobRecord) {
        let application = await jobService.getJobApplication(jobRecord.id!);

        const apiCallRecord = {
          timestamp: new Date(),
          endpoint: '/api/cover_letter',
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
          tokensUsed: result.tokensUsed,
          cost: result.cost || 0,
          processingTime
        };

        if (!application) {
          // Create new application
          await jobService.createApplication({
            userId: auth.user.id!,
            jobId: jobRecord.id!,
            platform,
            status: 'pending',
            coverLetter: result.answer,
            apiCalls: [apiCallRecord]
          });
        } else {
          // Update existing application
          await jobService.addApiCall(jobRecord.id!, apiCallRecord);
          await jobService.updateApplication(jobRecord.id!, {
            coverLetter: result.answer
          });
        }
      }
    } catch (trackingError) {
      console.error('Job tracking error:', trackingError);
      // Don't fail the request if tracking fails
    }

    // Return only cover_letter and job_id
    return json({
      cover_letter: result.answer,
      job_id
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
