import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MultiProviderService } from '$lib/multi-provider-service';
import { RAG_CONFIG } from '$lib/rag-config';
import { getDB } from '$lib/db/mongodb';
import { UserModel } from '$lib/models/user';
import { RetrievalService } from '$lib/services/retrieval-service';
import crypto from 'crypto';
import { validatePayloadGuardrails } from '$lib/services/payload-guardrails';

const multiProvider = new MultiProviderService();

// POST /api/employer-questions/compare - Generate answers with all enabled providers
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { userId, prompt, questions, details } = body;
    const stream = body.stream !== false; // Default to true
    const useRag = body.useRag !== false && RAG_CONFIG.enabled;

    if (!userId || !prompt || !questions) {
      return json({
        success: false,
        error: 'Missing userId, prompt, or questions'
      }, { status: 400 });
    }

    const payloadErrors = validatePayloadGuardrails({
      body,
      jobDetails: details,
      prompt,
      questions
    });
    if (payloadErrors.length > 0) {
      return json(
        {
          success: false,
          error: payloadErrors[0],
          details: payloadErrors
        },
        { status: 413 }
      );
    }

    // Build the full prompt with questions
    const questionsText = questions.map((q: any, i: number) =>
      `Q${i+1} (${q.type || 'select'}): ${q.q}\nOptions: ${(q.options || q.opts || []).join(', ')}`
    ).join('\n\n');

    let ragContext = '';
    let retrievalStats: Record<string, unknown> = {};
    let evidenceByQuestion: Array<Array<Record<string, unknown>>> = [];
    let contextSnapshotId: string | undefined;

    if (useRag) {
      try {
        const db = await getDB();
        const userModel = new UserModel(db);
        const user = await userModel.findByEmail(userId);
        if (user?._id) {
          const retrievalService = new RetrievalService(db);
          const retrievalStart = Date.now();

          for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            const retrieval = await retrievalService.retrieve(
              user._id,
              `${question.q || ''}\n${details || ''}`,
              {
                profileId: body.profileId || 'default',
                jobId: body.jobId,
                topK: body.retrievalConfig?.topK,
                initialK: body.retrievalConfig?.initialK,
                maxContextTokens: body.retrievalConfig?.maxContextTokens
              }
            );
            ragContext += `Q${i + 1} RETRIEVED CONTEXT:\n${
              retrieval.chunks
                .map((c, idx) => `[${idx + 1}] (score=${c.score.toFixed(3)}, docType=${c.docType})\n${c.text}`)
                .join('\n\n')
            }\n\n`;
            evidenceByQuestion.push(
              retrieval.chunks.map((c) => ({
                chunkId: c.chunkId,
                docId: c.docId,
                type: 'rag_chunk',
                score: Number(c.score.toFixed(4)),
                snippet: c.text.length > 220 ? `${c.text.slice(0, 220)}...` : c.text,
                reason: `Retrieved for employer question ${i + 1}`,
                docType: c.docType
              }))
            );
          }

          retrievalStats = {
            elapsedMs: Date.now() - retrievalStart,
            questionCount: questions.length,
            topK: body.retrievalConfig?.topK ?? RAG_CONFIG.topK
          };
          contextSnapshotId = crypto
            .createHash('sha256')
            .update(JSON.stringify({ userId, questions, details, ragContext }))
            .digest('hex');
        }
      } catch (retrievalError) {
        retrievalStats = {
          error: retrievalError instanceof Error ? retrievalError.message : 'unknown retrieval error'
        };
      }
    }

    const fullPrompt = `${prompt}\n\n${
      ragContext.trim().length > 0 ? `RETRIEVED EVIDENCE (USE THIS FIRST):\n${ragContext}\n` : ''
    }${details ? `JOB DESCRIPTION:\n${details}\n\n` : ''}QUESTIONS:\n${questionsText}`;

    // If streaming is requested, use Server-Sent Events
    const queryOptions = ragContext.trim().length > 0
      ? {
          prebuiltPrompt: fullPrompt,
          disableAutoDocuments: true,
          contextSnapshotId,
          retrievalMetadata: {
            retrievalStats,
            evidenceByQuestion
          }
        }
      : undefined;

    if (stream) {
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            await multiProvider.queryAllStreaming(userId, fullPrompt, (providerId, result) => {
              // Transform result to include text property for frontend compatibility
              const transformedResult = {
                ...result,
                text: result.answer || result.error || '',
                error: result.success ? undefined : result.error
              };
              // Send each result as it completes
              const data = `data: ${JSON.stringify({
                providerId,
                result: transformedResult,
                retrievalContextId: contextSnapshotId
              })}\n\n`;
              controller.enqueue(encoder.encode(data));
            }, queryOptions);

            // Signal completion
            controller.enqueue(encoder.encode('data: {"done": true}\n\n'));
            controller.close();
          } catch (error) {
            const errorData = `data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Query failed' })}\n\n`;
            controller.enqueue(encoder.encode(errorData));
            controller.close();
          }
        }
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }

    // Fallback to non-streaming
    const resultsMap = await multiProvider.queryAll(userId, fullPrompt, queryOptions);

    // Transform the results map into an array format expected by the frontend
    const results = Object.entries(resultsMap).map(([providerId, response]) => ({
      providerId,
      error: response.success ? undefined : response.error,
      text: response.answer,
      metadata: response.metadata
    }));

    return json({
      success: true,
      results,
      retrievalContextId: contextSnapshotId,
      retrievalStats
    });
  } catch (error) {
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Employer questions generation failed'
      },
      { status: 500 }
    );
  }
};