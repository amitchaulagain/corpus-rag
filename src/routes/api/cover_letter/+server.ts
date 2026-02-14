import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MultiProviderService } from '$lib/multi-provider-service';
import { requirePermission } from '$lib/auth-middleware';
import { getDB } from '$lib/db/mongodb';
import { JobModel } from '$lib/models/job';
import { UsageModel } from '$lib/models/usage';
import { TokenService } from '$lib/services/token-service';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import { RAG_CONFIG } from '$lib/rag-config';
import { RetrievalService } from '$lib/services/retrieval-service';
import { QaCacheModel } from '$lib/models/qa-cache';

const multiProvider = new MultiProviderService();
const TOKEN_COST_COVER_LETTER = TokenService.TOKEN_COSTS.coverLetter;

export const POST: RequestHandler = async (event) => {
  let requestBody: any = {};
  let auth: any = null;

  try {
    // Check authentication and permission
    auth = await requirePermission(event, 'cover_letter');

    requestBody = await event.request.json();
    const {
      job_id,
      job_details,
      resume_text,
      useAi,
      prompt,
      platform = 'other',  // seek, linkedin, indeed, other
      job_title,
      company,
      platform_job_id,
      useRag = true,
      profileId = 'default',
      profileVersion = 'v1',
      retrievalConfig
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
      TOKEN_COST_COVER_LETTER
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
          purchaseUrl: '/plans' // Frontend should handle this
        },
        { status: 402 } // 402 Payment Required
      );
    }

    const startTime = Date.now();
    const db = await getDB();
    const userObjectId = new ObjectId(auth.user._id);
    const qaCacheModel = new QaCacheModel(db);
    const effectiveJobId = String(platform_job_id || job_id);
    const promptVersion = crypto.createHash('sha256').update(String(prompt || 'default-cover-letter-prompt')).digest('hex');
    const questionHash = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          job_id,
          platform_job_id,
          job_details,
          prompt,
          resumeHash: crypto.createHash('sha256').update(String(resume_text)).digest('hex')
        })
      )
      .digest('hex');
    const ragEnabled = RAG_CONFIG.enabled && useRag !== false;
    let retrievalStats: Record<string, unknown> = {};
    let evidence: Array<Record<string, unknown>> = [];
    let warning: string | undefined;

    if (ragEnabled) {
      const cached = await qaCacheModel.get({
        userId: userObjectId,
        profileId,
        jobId: effectiveJobId,
        questionHash,
        promptVersion,
        profileVersion
      });
      if (cached?.answer) {
        const finalBalanceCached = await tokenService.getBalance(userObjectId);
        return json({
          cover_letter: cached.answer,
          job_id,
          tokensUsed: 0,
          actualTokensUsed: 0,
          inputTokens: 0,
          outputTokens: 0,
          remainingBalance: finalBalanceCached,
          retrievalStats: cached.retrievalStats ?? {},
          evidence: cached.evidence ?? [],
          cacheHit: true
        });
      }
    }

    // Build the full prompt for AI
    // Use user's custom prompt if provided, otherwise use default
    let fullPrompt = '';
    let ragContextBlock = '';
    let ragContextSnapshotId: string | undefined;

    if (ragEnabled) {
      try {
        const retrievalService = new RetrievalService(db);
        const retrievalStart = Date.now();
        const retrieval = await retrievalService.retrieve(
          userObjectId,
          `Generate tailored cover letter for ${job_title || ''} at ${company || ''}\n${typeof job_details === 'string' ? job_details : JSON.stringify(job_details)}`,
          {
            profileId,
            jobId: effectiveJobId,
            topK: retrievalConfig?.topK,
            initialK: retrievalConfig?.initialK,
            maxContextTokens: retrievalConfig?.maxContextTokens
          }
        );

        ragContextBlock = retrieval.chunks
          .map((c, index) => `[${index + 1}] (score=${c.score.toFixed(3)}, docType=${c.docType})\n${c.text}`)
          .join('\n\n');
        evidence = retrieval.chunks.map((c) => ({
          chunkId: c.chunkId,
          docId: c.docId,
          type: 'rag_chunk',
          score: Number(c.score.toFixed(4)),
          snippet: c.text.length > 260 ? `${c.text.slice(0, 260)}...` : c.text,
          reason: 'Retrieved for cover letter generation',
          docType: c.docType
        }));
        retrievalStats = {
          ...retrieval.stats,
          elapsedMsTotal: Date.now() - retrievalStart,
          topK: retrievalConfig?.topK ?? RAG_CONFIG.topK
        };
        ragContextSnapshotId = crypto
          .createHash('sha256')
          .update(JSON.stringify({ questionHash, profileId, profileVersion, ragContextBlock }))
          .digest('hex');

        if (!ragContextBlock.trim()) {
          warning = 'RAG enabled but no indexed chunks found. Falling back to full-context prompt.';
        }
      } catch (retrievalError) {
        warning = `RAG retrieval failed, fallback used: ${retrievalError instanceof Error ? retrievalError.message : 'unknown error'}`;
      }
    }

    if (prompt) {
      // User provided their own prompt - use it as the main instruction
      fullPrompt = `${prompt}

${ragContextBlock ? `RETRIEVED EVIDENCE (USE THIS FIRST):\n${ragContextBlock}\n` : ''}
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
${ragContextBlock ? '- Ground claims in retrieved evidence and do not invent facts' : ''}

${ragContextBlock ? `RETRIEVED EVIDENCE:\n${ragContextBlock}\n` : ''}
Please format as a professional cover letter with proper greeting and closing.`;
    }

    // Query the AI provider with RAG context or fallback prompting
    const useRagPrompt = ragEnabled && ragContextBlock.trim().length > 0;
    const result = await multiProvider.querySingle(
      auth.user.email, // Use actual user email instead of 'external'
      fullPrompt,
      useAi,
      useRagPrompt ? undefined : resume_text,
      useRagPrompt
        ? {
            prebuiltPrompt: fullPrompt,
            disableAutoDocuments: true,
            contextSnapshotId: ragContextSnapshotId,
            retrievalMetadata: {
              retrievalStats,
              evidence
            }
          }
        : undefined
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
    const meta = result.metadata;
    const tokensUsed = meta?.tokensUsed ?? 0;
    const costUsd = (typeof meta?.cost === 'object' && meta?.cost != null && 'usd' in meta.cost)
      ? (meta.cost as { usd: number }).usd
      : 0;
    const inputTokens = meta?.inputTokens;
    const outputTokens = meta?.outputTokens;

    // Track usage in the usage collection for dashboard
    try {
      const usageModel = new UsageModel(db);
      await usageModel.track({
        userId: new ObjectId(auth.user._id),
        endpoint: 'cover_letter',
        jobId: job_id,
        aiProvider: useAi,
        tokensUsed,
        costUsd,
        success: true,
        metadata: {
          processingTime,
          model: useAi,
          inputTokens,
          outputTokens
        }
      });
    } catch (usageError) {
      console.error('Usage tracking error:', usageError);
      // Don't fail the request if usage tracking fails
    }

    // Track this job and API call in database
    try {
      const jobModel = new JobModel(db);
      const userId = userObjectId;

      // Find or create job record
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

      // Deduct tokens after successful generation (with job record if available)
      const tokenDeduction = await tokenService.deductTokens(
        new ObjectId(auth.user._id),
        TOKEN_COST_COVER_LETTER,
        {
          jobId: jobRecord?._id,
          endpoint: '/api/cover_letter',
          aiProvider: useAi,
          description: `Cover letter generation for ${company || 'job'} - ${job_title || job_id}`
        }
      );

      if (!tokenDeduction.success) {
        // This shouldn't happen since we checked, but handle it gracefully
        console.error('Token deduction failed after successful generation:', tokenDeduction);
      }

      // Create or update job application record (embedded in job)
      if (jobRecord) {
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
          tokensUsed,
          inputTokens,
          outputTokens,
          cost: costUsd,
          processingTime,
          rag: {
            enabled: ragEnabled,
            used: useRagPrompt,
            retrievalStats,
            warning
          }
        };

        if (!jobRecord.application) {
          // Create new application (embedded)
          await jobModel.createApplication(jobRecord._id!, {
            status: 'pending',
            coverLetter: result.answer,
            apiCalls: [apiCallRecord],
            automationLogs: []
          });
        } else {
          // Update existing application
          await jobModel.addApiCall(jobRecord._id!, apiCallRecord);
          await jobModel.updateApplication(jobRecord._id!, {
            coverLetter: result.answer
          });
        }
      }
    } catch (trackingError) {
      console.error('Job tracking error:', trackingError);
      // Don't fail the request if tracking fails
    }

    // Get final token balance (in case deduction happened in tracking block)
    const finalBalance = await tokenService.getBalance(userObjectId);

    if (ragEnabled && result.answer) {
      await qaCacheModel.upsert({
        userId: userObjectId,
        profileId,
        jobId: effectiveJobId,
        questionHash,
        promptVersion,
        profileVersion,
        answer: result.answer,
        retrievalStats,
        evidence,
        validationStatus: 'valid',
        ttlHours: RAG_CONFIG.cacheTtlHours
      });
    }

    // Return cover_letter, job_id, and token usage info (for clients to save and send to job-applications)
    return json({
      cover_letter: result.answer,
      job_id,
      tokensUsed: TOKEN_COST_COVER_LETTER,
      actualTokensUsed: tokensUsed,
      inputTokens,
      outputTokens,
      remainingBalance: finalBalance,
      retrievalStats,
      evidence,
      cacheHit: false,
      warning
    });

  } catch (error) {
    // Track failed usage if we have auth
    if (auth?.user?._id) {
      try {
        const db = await getDB();
        const usageModel = new UsageModel(db);

        await usageModel.track({
          userId: new ObjectId(auth.user._id),
          endpoint: 'cover_letter',
          jobId: requestBody.job_id || 'unknown',
          aiProvider: requestBody.useAi || 'unknown',
          tokensUsed: 0,
          costUsd: 0,
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
      } catch (trackingError) {
        // Ignore tracking errors
        console.error('Failed to track error usage:', trackingError);
      }
    }

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
