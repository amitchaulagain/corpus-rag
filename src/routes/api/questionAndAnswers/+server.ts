import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MultiProviderService } from '$lib/multi-provider-service';
import { requirePermission } from '$lib/auth-middleware';
import { getDB } from '$lib/db/mongodb';
import { JobModel } from '$lib/models/job';
import { TokenService } from '$lib/services/token-service';
import { ObjectId } from 'mongodb';

const multiProvider = new MultiProviderService();
const TOKEN_COST_QA = TokenService.TOKEN_COSTS.qaGeneration;

export const POST: RequestHandler = async (event) => {
  try {
    // Check authentication and permission
    const auth = await requirePermission(event, 'questionAndAnswers');

    const requestBody = await event.request.json();
    const {
      job_id,
      questions,
      resume_text,
      useAi,
      prompt,
      job_details,
      platform = 'other',
      job_title,
      company,
      platform_job_id
    } = requestBody;

    // Validate required fields
    if (!job_id || !questions || !Array.isArray(questions) || !resume_text || !useAi) {
      return json(
        {
          success: false,
          error: 'Missing required fields: job_id, questions (array), resume_text, useAi are required'
        },
        { status: 400 }
      );
    }

    // Check token balance before processing
    const tokenService = await TokenService.create();
    const tokenCheck = await tokenService.checkTokens(
      new ObjectId(auth.user._id),
      TOKEN_COST_QA
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

    // Format questions for the prompt
    const questionsText = questions.map((q, index) =>
      `Question ${index + 1}: ${q.q || q.question || q.text}
Options: ${(q.opts || q.options || []).join(', ')}`
    ).join('\n\n');

    // Build the full prompt for AI
    // Use user's custom prompt if provided, otherwise use default
    let fullPrompt = '';

    if (prompt) {
      // User provided their own prompt - use it as the main instruction
      fullPrompt = `${prompt}

QUESTIONS:
${questionsText}
${job_details ? `\nJOB DESCRIPTION:\n${typeof job_details === 'string' ? job_details : JSON.stringify(job_details, null, 2)}` : ''}`;
    } else {
      // Fallback to default prompt
      fullPrompt = `For each of these employer questions: ${questionsText}

Provide the best answer choice and a brief rationale. Consider:
- My actual experience level and background
- What the employer is really asking (subtext)
- Which answer positions me as the ideal candidate
- Consistency with my resume and cover letter
${job_details ? '- Alignment with the specific job requirements' : ''}

Format: Question → Recommended Answer → 2-sentence rationale

Please be specific about which option number (starting from 0) to select for each question.
${job_details ? `\nJob Context: ${typeof job_details === 'string' ? job_details : JSON.stringify(job_details, null, 2)}` : ''}`;
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
          error: result.error || 'Question answers generation failed'
        },
        { status: 500 }
      );
    }

    const processingTime = Date.now() - startTime;

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
          TOKEN_COST_QA,
          {
            jobId: jobRecord._id,
            endpoint: '/api/questionAndAnswers',
            aiProvider: useAi,
            description: `Q&A generation for ${company || 'job'} - ${job_title || job_id}`
          }
        );

        if (!tokenDeduction.success) {
          console.error('Token deduction failed after successful generation:', tokenDeduction);
        }

        const apiCallRecord = {
          timestamp: new Date(),
          endpoint: '/api/questionAndAnswers',
          aiProvider: useAi,
          request: {
            prompt,
            jobDetails: job_details,
            resumeText: resume_text,
            questions
          },
          response: {
            success: true,
            data: result.answer
          },
          tokensUsed: result.tokensUsed,
          cost: result.cost || 0,
          processingTime
        };

        // Parse questions and answers for storage
        const questionAnswers = questions.map((q: any, index: number) => ({
          question: q.q || q.question || q.text,
          answer: result.answer // The AI will provide structured answers
        }));

        if (!jobRecord.application) {
          await jobModel.createApplication(jobRecord._id!, {
            status: 'pending',
            questionAnswers,
            apiCalls: [apiCallRecord],
            automationLogs: []
          });
        } else {
          await jobModel.addApiCall(jobRecord._id!, apiCallRecord);
          await jobModel.updateApplication(jobRecord._id!, {
            questionAnswers
          });
        }
      } else {
        // Deduct tokens even if no job record
        const tokenDeduction = await tokenService.deductTokens(
          new ObjectId(auth.user._id),
          TOKEN_COST_QA,
          {
            endpoint: '/api/questionAndAnswers',
            aiProvider: useAi,
            description: `Q&A generation for ${company || 'job'} - ${job_title || job_id}`
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

    // Return answers, job_id, and token usage info
    return json({
      answers: result.answer,
      job_id,
      questions_count: questions.length,
      tokensUsed: TOKEN_COST_QA,
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
