import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MultiProviderService } from '$lib/multi-provider-service';
import { requirePermission } from '$lib/auth-middleware';
import { getDB } from '$lib/db/mongodb';
import { JobModel } from '$lib/models/job';
import { TokenService } from '$lib/services/token-service';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import { RAG_CONFIG } from '$lib/rag-config';
import { RetrievalService } from '$lib/services/retrieval-service';
import { validateQuestionAnswers } from '$lib/services/rag-answer-validator';
import { QaCacheModel } from '$lib/models/qa-cache';

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
      platform_job_id,
      useRag = true,
      profileId = 'default',
      profileVersion = 'v1',
      retrievalConfig
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
    const db = await getDB();
    const userObjectId = new ObjectId(auth.user._id);
    const qaCacheModel = new QaCacheModel(db);

    const normalizedQuestions = questions.map((q) => ({
      q: String(q.q || q.question || q.text || ''),
      type: String(q.type || 'select'),
      options: Array.isArray(q.opts || q.options) ? (q.opts || q.options) : []
    }));

    const questionHash = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          job_id,
          platform_job_id,
          questions: normalizedQuestions,
          job_details
        })
      )
      .digest('hex');
    const promptVersion = crypto.createHash('sha256').update(String(prompt || 'default-qa-prompt')).digest('hex');
    const effectiveJobId = String(platform_job_id || job_id);

    const ragEnabled = RAG_CONFIG.enabled && useRag !== false;
    let retrievalStats: Record<string, unknown> = {};
    let evidenceByQuestion: Array<Array<Record<string, unknown>>> = [];
    let cacheHit = false;
    let validationStatus: 'valid' | 'repaired' | 'invalid' = 'valid';
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
          answers: cached.answer,
          job_id,
          questions_count: questions.length,
          tokensUsed: 0,
          actualTokensUsed: 0,
          inputTokens: 0,
          outputTokens: 0,
          remainingBalance: finalBalanceCached,
          retrievalStats: cached.retrievalStats ?? {},
          evidence: cached.evidence ?? [],
          cacheHit: true,
          validationStatus: cached.validationStatus ?? 'valid'
        });
      }
    }

    // Format questions for the prompt
    const questionsText = questions.map((q, index) =>
      `Question ${index + 1}: ${q.q || q.question || q.text}
Options: ${(q.opts || q.options || []).join(', ')}`
    ).join('\n\n');

    let ragContextBlock = '';
    let ragContextSnapshotId: string | undefined;
    if (ragEnabled) {
      try {
        const retrievalService = new RetrievalService(db);
        const retrievalStart = Date.now();
        const contextBlocks: string[] = [];

        for (let i = 0; i < normalizedQuestions.length; i++) {
          const q = normalizedQuestions[i];
          const retrieval = await retrievalService.retrieve(
            userObjectId,
            `${q.q}\nJob title: ${job_title || ''}\nCompany: ${company || ''}`,
            {
              profileId,
              jobId: effectiveJobId,
              topK: retrievalConfig?.topK,
              initialK: retrievalConfig?.initialK,
              maxContextTokens: retrievalConfig?.maxContextTokens
            }
          );
          contextBlocks.push(
            `Q${i + 1} RETRIEVED CONTEXT:\n${retrieval.chunks.map((c, index) => (
              `[${index + 1}] (score=${c.score.toFixed(3)}, docType=${c.docType})\n${c.text}`
            )).join('\n\n')}`
          );
          evidenceByQuestion.push(
            retrieval.chunks.map((c) => ({
              chunkId: c.chunkId,
              docId: c.docId,
              type: 'rag_chunk',
              score: Number(c.score.toFixed(4)),
              snippet: c.text.length > 240 ? `${c.text.slice(0, 240)}...` : c.text,
              reason: `Retrieved for employer question ${i + 1}`,
              docType: c.docType
            }))
          );
        }

        ragContextBlock = contextBlocks.join('\n\n---\n\n');
        retrievalStats = {
          elapsedMs: Date.now() - retrievalStart,
          questionCount: normalizedQuestions.length,
          topK: retrievalConfig?.topK ?? RAG_CONFIG.topK,
          maxContextTokens: retrievalConfig?.maxContextTokens ?? RAG_CONFIG.maxContextTokens
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

    // Build the full prompt for AI
    // Use user's custom prompt if provided, otherwise use default
    let fullPrompt = '';
    const addRagContext = ragContextBlock.trim().length > 0;

    if (prompt) {
      // User provided their own prompt - use it as the main instruction
      fullPrompt = `${prompt}

${addRagContext ? `RETRIEVED EVIDENCE (USE THIS FIRST):\n${ragContextBlock}\n\n` : ''}
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
${addRagContext ? '- You MUST prioritize the retrieved evidence and avoid unsupported claims' : ''}

Return ONLY a JSON array:
- "select" questions => single number (0-based index)
- "checkbox" questions => array of numbers (0-based indices)
- "text" questions => concise string answer

Array length MUST exactly match question count.
Do not return explanations.
${addRagContext ? `\nRETRIEVED EVIDENCE:\n${ragContextBlock}` : ''}
${job_details ? `\nJob Context: ${typeof job_details === 'string' ? job_details : JSON.stringify(job_details, null, 2)}` : ''}`;
    }

    // Query the AI provider with RAG context or legacy fallback
    const useRagPrompt = ragEnabled && addRagContext;
    const queryOptions = useRagPrompt
      ? {
          prebuiltPrompt: fullPrompt,
          disableAutoDocuments: true,
          contextSnapshotId: ragContextSnapshotId,
          retrievalMetadata: {
            retrievalStats,
            evidenceByQuestion
          }
        }
      : undefined;
    const result = await multiProvider.querySingle(
      auth.user.email, // Use actual user email
      fullPrompt,
      useAi,
      useRagPrompt ? undefined : resume_text,
      queryOptions
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

    let finalAnswer = result.answer ?? '';
    const firstValidation = validateQuestionAnswers(finalAnswer, normalizedQuestions);

    if (!firstValidation.valid) {
      const repairPrompt = `${fullPrompt}

Your previous response was invalid: ${firstValidation.reason}
Return a corrected JSON array now. Only array, no extra text.`;

      const repaired = await multiProvider.querySingle(
        auth.user.email,
        repairPrompt,
        useAi,
        useRagPrompt ? undefined : resume_text,
        useRagPrompt
          ? {
              prebuiltPrompt: repairPrompt,
              disableAutoDocuments: true,
              contextSnapshotId: ragContextSnapshotId,
              retrievalMetadata: {
                retrievalStats,
                evidenceByQuestion
              }
            }
          : undefined
      );

      if (repaired.success && repaired.answer) {
        const secondValidation = validateQuestionAnswers(repaired.answer, normalizedQuestions);
        if (secondValidation.valid) {
          finalAnswer = repaired.answer;
          validationStatus = 'repaired';
        } else {
          validationStatus = 'invalid';
        }
      } else {
        validationStatus = 'invalid';
      }
    }

    const processingTime = Date.now() - startTime;
    const meta = result.metadata;
    const tokensUsed = meta?.tokensUsed ?? 0;
    const costUsd = (typeof meta?.cost === 'object' && meta?.cost != null && 'usd' in meta.cost)
      ? (meta.cost as { usd: number }).usd
      : 0;
    const inputTokens = meta?.inputTokens;
    const outputTokens = meta?.outputTokens;

    // Track this job and API call in database
    try {
      const jobModel = new JobModel(db);
      const userId = userObjectId;

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
            data: finalAnswer
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
            validationStatus,
            warning
          }
        };

        // Parse questions and answers for storage
        const questionAnswers = questions.map((q: any, index: number) => ({
          question: q.q || q.question || q.text,
          answer: finalAnswer // The AI will provide structured answers
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

    if (ragEnabled && validationStatus !== 'invalid') {
      await qaCacheModel.upsert({
        userId: userObjectId,
        profileId,
        jobId: effectiveJobId,
        questionHash,
        promptVersion,
        profileVersion,
        answer: finalAnswer,
        retrievalStats,
        evidence: evidenceByQuestion,
        validationStatus,
        ttlHours: RAG_CONFIG.cacheTtlHours
      });
    }

    // Get final token balance
    const finalBalance = await tokenService.getBalance(userObjectId);

    // Return answers, job_id, and token usage info (for clients to save and send to job-applications)
    return json({
      answers: finalAnswer,
      job_id,
      questions_count: questions.length,
      tokensUsed: TOKEN_COST_QA,
      actualTokensUsed: tokensUsed,
      inputTokens,
      outputTokens,
      remainingBalance: finalBalance,
      retrievalStats,
      evidence: evidenceByQuestion,
      cacheHit,
      validationStatus,
      warning
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
