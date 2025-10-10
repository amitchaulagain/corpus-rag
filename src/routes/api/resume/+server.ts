import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MultiProviderService } from '$lib/multi-provider-service';
import { requirePermission } from '$lib/auth-middleware';
import { jobService } from '$lib/db/job-service';

const multiProvider = new MultiProviderService();

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

    // Track this job and API call in database
    try {
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

      if (jobRecord) {
        let application = await jobService.getJobApplication(jobRecord.id!);

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
          tokensUsed: result.tokensUsed,
          cost: result.cost || 0,
          processingTime
        };

        if (!application) {
          await jobService.createApplication({
            userId: auth.user.id!,
            jobId: jobRecord.id!,
            platform,
            status: 'pending',
            tailoredResume: result.answer,
            apiCalls: [apiCallRecord]
          });
        } else {
          await jobService.addApiCall(jobRecord.id!, apiCallRecord);
          await jobService.updateApplication(jobRecord.id!, {
            tailoredResume: result.answer
          });
        }
      }
    } catch (trackingError) {
      console.error('Job tracking error:', trackingError);
    }

    // Return only resume and job_id
    return json({
      resume: result.answer,
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
