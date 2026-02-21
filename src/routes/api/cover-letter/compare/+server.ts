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

// POST /api/cover-letter/compare - Generate cover letter with all enabled providers
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { userId, prompt, jobDescription } = body;
    const stream = body.stream !== false; // Default to true
    const useRag = body.useRag !== false && RAG_CONFIG.enabled;

    if (!userId || !prompt || !jobDescription) {
      return json({
        success: false,
        error: 'Missing userId, prompt, or jobDescription'
      }, { status: 400 });
    }

    const payloadErrors = validatePayloadGuardrails({
      body,
      jobDetails: jobDescription,
      prompt
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

    let ragContext = '';
    let retrievalStats: Record<string, unknown> = {};
    let evidence: Array<Record<string, unknown>> = [];
    let contextSnapshotId: string | undefined;

    if (useRag) {
      try {
        const db = await getDB();
        const userModel = new UserModel(db);
        const user = await userModel.findByEmail(userId);
        if (user?._id) {
          const retrievalService = new RetrievalService(db);
          const retrievalStart = Date.now();
          const retrieval = await retrievalService.retrieve(
            user._id,
            `Generate cover letter\n${jobDescription}`,
            {
              profileId: body.profileId || 'default',
              jobId: body.jobId,
              topK: body.retrievalConfig?.topK,
              initialK: body.retrievalConfig?.initialK,
              maxContextTokens: body.retrievalConfig?.maxContextTokens
            }
          );

          ragContext = retrieval.chunks
            .map((c, index) => `[${index + 1}] (score=${c.score.toFixed(3)}, docType=${c.docType})\n${c.text}`)
            .join('\n\n');
          evidence = retrieval.chunks.map((c) => ({
            chunkId: c.chunkId,
            docId: c.docId,
            type: 'rag_chunk',
            score: Number(c.score.toFixed(4)),
            snippet: c.text.length > 260 ? `${c.text.slice(0, 260)}...` : c.text,
            reason: 'Retrieved for cover letter compare',
            docType: c.docType
          }));
          retrievalStats = {
            ...retrieval.stats,
            elapsedMsTotal: Date.now() - retrievalStart,
            topK: body.retrievalConfig?.topK ?? RAG_CONFIG.topK
          };
          contextSnapshotId = crypto
            .createHash('sha256')
            .update(JSON.stringify({ userId, jobDescription, ragContext }))
            .digest('hex');
        }
      } catch (retrievalError) {
        retrievalStats = {
          error: retrievalError instanceof Error ? retrievalError.message : 'unknown retrieval error'
        };
      }
    }

    // Build the full prompt with job description and user's resume/files
    const fullPrompt = `${prompt}

${ragContext ? `RETRIEVED EVIDENCE (USE THIS FIRST):\n${ragContext}\n` : ''}

JOB DESCRIPTION:
${jobDescription}

Please write a compelling cover letter based on the above job description and my resume/documents.`;

    const queryOptions = ragContext.trim().length > 0
      ? {
          prebuiltPrompt: fullPrompt,
          disableAutoDocuments: true,
          contextSnapshotId,
          retrievalMetadata: {
            retrievalStats,
            evidence
          }
        }
      : undefined;

    // If streaming is requested, use Server-Sent Events
    if (stream) {
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            await multiProvider.queryAllStreaming(userId, fullPrompt, (providerId, result) => {
              // Send each result as it completes
              const data = `data: ${JSON.stringify({ providerId, result, retrievalContextId: contextSnapshotId })}\n\n`;
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
    const results = await multiProvider.queryAll(userId, fullPrompt, queryOptions);

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
        error: error instanceof Error ? error.message : 'Cover letter generation failed'
      },
      { status: 500 }
    );
  }
};
