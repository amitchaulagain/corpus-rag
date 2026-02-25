import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import fs from 'fs';
import path from 'path';
import { MultiProviderService } from '$lib/multi-provider-service';
import { requirePermission } from '$lib/auth-middleware';
import { TokenService } from '$lib/services/token-service';
import { ObjectId } from 'mongodb';
import { validatePayloadGuardrails } from '$lib/services/payload-guardrails';

const multiProvider = new MultiProviderService();
const TOKEN_COST_ATS = 1; // Lighter than full resume tailoring

function loadPromptTemplate(): string {
  const p = path.join(process.cwd(), 'src', 'lib', 'prompts', 'resume-ats-score.txt');
  return fs.readFileSync(p, 'utf-8');
}

function parseJsonFromResponse(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  let jsonStr = trimmed;
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  } else {
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first !== -1 && last > first) {
      jsonStr = trimmed.slice(first, last + 1);
    }
  }
  return JSON.parse(jsonStr) as Record<string, unknown>;
}

export const POST: RequestHandler = async (event) => {
  try {
    const auth = await requirePermission(event, 'resume');

    const requestBody = await event.request.json();
    const { resume_text, job_desc } = requestBody;

    if (!resume_text || !job_desc) {
      return json(
        { success: false, error: 'Missing required fields: resume_text and job_desc are required' },
        { status: 400 }
      );
    }

    const payloadErrors = validatePayloadGuardrails({
      body: requestBody,
      resumeText: resume_text,
      jobDetails: job_desc
    });
    if (payloadErrors.length > 0) {
      return json(
        { success: false, error: payloadErrors[0], details: payloadErrors },
        { status: 413 }
      );
    }

    const tokenService = await TokenService.create();
    const userObjectId = new ObjectId(auth.user._id);
    const tokenCheck = await tokenService.checkTokens(userObjectId, TOKEN_COST_ATS);

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
        { status: 402 }
      );
    }

    const template = loadPromptTemplate();
    const fullPrompt = template
      .replace(/\{resume_text\}/g, String(resume_text))
      .replace(/\{job_desc\}/g, String(job_desc));

    const result = await multiProvider.querySingle(
      auth.user.email,
      fullPrompt,
      'deepseek-chat',
      undefined,
      {
        prebuiltPrompt: fullPrompt,
        disableAutoDocuments: true
      }
    );

    if (!result.success) {
      return json(
        { success: false, error: result.error || 'ATS analysis failed' },
        { status: 500 }
      );
    }

    const answer = result.answer || '';
    let data: Record<string, unknown>;
    try {
      data = parseJsonFromResponse(answer);
    } catch (parseErr) {
      console.error('ATS response JSON parse error:', parseErr);
      return json(
        {
          success: false,
          error: 'Failed to parse ATS analysis response as JSON',
          rawPreview: answer.slice(0, 500)
        },
        { status: 500 }
      );
    }

    // Deduct tokens
    await tokenService.deductTokens(userObjectId, TOKEN_COST_ATS, {
      endpoint: '/api/resume/ats-score',
      aiProvider: 'deepseek-chat',
      description: 'ATS resume fit score analysis'
    });

    return json({ success: true, data });
  } catch (err) {
    console.error('ATS score error:', err);
    return json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error'
      },
      {
        status: err instanceof Error && err.message.includes('Permission') ? 403 :
          err instanceof Error && err.message.includes('Authentication') ? 401 : 500
      }
    );
  }
};
