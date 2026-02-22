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
import { IngestionService } from '$lib/services/ingestion-service';
import { calibrateCriticOverall } from '$lib/evals/cover-letter-calibration';
import { validatePayloadGuardrails } from '$lib/services/payload-guardrails';

const multiProvider = new MultiProviderService();
const TOKEN_COST_COVER_LETTER = TokenService.TOKEN_COSTS.coverLetter;
const MAX_REQUIREMENTS = 6;
const MAX_PROOF_POINTS = 8;
const DEFAULT_COVER_LETTER_RETRIEVAL_DOC_TYPES = ['resume', 'job_description', 'generic_question'];
const DEFAULT_QUALITY_THRESHOLD = 90;
const DEFAULT_STRICT_QUALITY_RETRIES = 1;
const QUALITY_AGREEMENT_FLOOR = 92;
const QUALITY_AGREEMENT_MAX_DELTA = 8;
const MAX_SCORE_WITHOUT_AGREEMENT = 89;

function toPlainText(input: unknown): string {
  if (typeof input === 'string') return input;
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input ?? '');
  }
}

function splitMeaningfulLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-*•\d.)\s]+/, ''))
    .filter((line) => line.length >= 18);
}

function extractJobRequirements(jobDetails: unknown): string[] {
  const text = toPlainText(jobDetails);
  const lines = splitMeaningfulLines(text);
  const priorityPattern = /(must|required|responsib|qualif|experience|skills?|proficient|familiar|expert|knowledge|ability)/i;
  const scored = lines
    .map((line) => ({ line, score: priorityPattern.test(line) ? 2 : 1 }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.line);

  const deduped = [...new Set(scored)];
  if (deduped.length > 0) return deduped.slice(0, MAX_REQUIREMENTS);

  return text
    .split(/[.!?]\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 30)
    .slice(0, 3);
}

function extractResumeProofPoints(resumeText: string): string[] {
  const lines = splitMeaningfulLines(resumeText);
  const metricPattern = /(\d+%|\$\d+|\d+\+|\d+\s*(years?|months?)|increased|reduced|improved|launched|built|designed|delivered|led)/i;
  const scored = lines
    .map((line) => ({ line, score: metricPattern.test(line) ? 2 : 1 }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.line);
  return [...new Set(scored)].slice(0, MAX_PROOF_POINTS);
}

function extractCandidateName(resumeText: string): string | null {
  const lines = resumeText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines.slice(0, 12)) {
    if (/^[A-Za-z][A-Za-z\s.'-]{2,60}$/.test(line) && !/(summary|experience|education|skills|projects)/i.test(line)) {
      return line;
    }
  }
  return null;
}

function buildAlignmentGuidance(jobDetails: unknown, resumeText: string): string {
  const requirements = extractJobRequirements(jobDetails);
  const proofPoints = extractResumeProofPoints(resumeText);
  const requirementBlock = requirements.map((item, idx) => `${idx + 1}. ${item}`).join('\n');
  const proofBlock = proofPoints.map((item, idx) => `${idx + 1}. ${item}`).join('\n');

  return `ALIGNMENT MAP (MANDATORY):
Top job requirements:
${requirementBlock || '1. Identify the most important requirements from the job description.'}

Best resume evidence to use:
${proofBlock || '1. Use verified resume evidence only; do not invent achievements.'}

Writing constraints:
- Map each body paragraph to specific requirements above.
- Cite concrete resume evidence with metrics where possible.
- If evidence is missing for a requirement, do NOT invent facts; keep wording honest and transferable.`;
}

function evaluateDraftQuality(answer: string): { needsRetry: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;

  if (wordCount < 180 || wordCount > 380) {
    reasons.push(`word_count_out_of_range (${wordCount})`);
  }
  if (/\[(your name|my name|name|company name)\]/i.test(answer)) {
    reasons.push('contains_placeholder_text');
  }
  if (/i am writing to express my interest|throughout my career|ideal candidate/i.test(answer)) {
    reasons.push('contains_generic_cliches');
  }
  if (!/(dear|hi)\s+/i.test(answer)) {
    reasons.push('missing_greeting');
  }
  if (!/(best|thanks|sincerely),/i.test(answer)) {
    reasons.push('missing_professional_closing');
  }

  return { needsRetry: reasons.length > 0, reasons };
}

type CoverLetterQualityScore = {
  overall: number;
  alignment: number;
  specificity: number;
  tone: number;
  structure: number;
  compliance: number;
  reasons: string[];
  scoringMethod?: 'heuristic_only' | 'hybrid';
  cappedByAgreement?: boolean;
  critic?: {
    rawOverall: number;
    calibratedOverall: number;
    biasAdjustment: number;
    datasetSize: number;
    agreementDelta: number;
    agreementPassed: boolean;
    reasons: string[];
    unsupported_claims: string[];
    evidence_grounding: number;
  };
};

type ContactProfile = {
  full_name?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
};

type LlmCriticScore = {
  overall: number;
  alignment: number;
  specificity: number;
  tone: number;
  structure: number;
  compliance: number;
  evidence_grounding: number;
  unsupported_claims: string[];
  reasons: string[];
};

function normalizeContactProfile(input: unknown): ContactProfile {
  if (!input || typeof input !== 'object') return {};
  const profile = input as Record<string, unknown>;
  return {
    full_name: typeof profile.full_name === 'string' ? profile.full_name.trim() : '',
    email: typeof profile.email === 'string' ? profile.email.trim() : '',
    phone: typeof profile.phone === 'string' ? profile.phone.trim() : '',
    linkedin_url: typeof profile.linkedin_url === 'string' ? profile.linkedin_url.trim() : ''
  };
}

function scoreCoverLetterQuality(
  answer: string,
  requirements: string[],
  proofPoints: string[]
): CoverLetterQualityScore {
  const reasons: string[] = [];
  const lower = answer.toLowerCase();
  const words = answer.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const paragraphs = answer.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  // Alignment: requirement keyword overlap
  const requirementHits = requirements.filter((req) => {
    const tokens = req
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 5)
      .slice(0, 4);
    return tokens.some((token) => lower.includes(token));
  }).length;
  const alignment = requirements.length
    ? Math.min(100, Math.round((requirementHits / requirements.length) * 100))
    : 60;
  if (alignment < 60) reasons.push('weak_job_alignment');

  // Specificity: metrics + concrete evidence phrase overlaps
  const metricHits = (answer.match(/(\d+%|\$\d+|\d+\+|\d+\s*(years?|months?))/gi) || []).length;
  const evidenceHits = proofPoints.filter((point) => {
    const key = point.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 6).slice(0, 3);
    return key.some((token) => lower.includes(token));
  }).length;
  const specificity = Math.min(100, metricHits * 20 + evidenceHits * 12 + 20);
  if (specificity < 55) reasons.push('low_specificity');

  // Tone: penalize clichés and robotic phrases
  const clichéMatches = (answer.match(/i am writing to express my interest|throughout my career|ideal candidate|dynamic professional/gi) || []).length;
  const tone = Math.max(20, 100 - clichéMatches * 25);
  if (tone < 70) reasons.push('generic_tone');

  // Structure: greeting + closing + paragraph flow
  const hasGreeting = /(dear|hi)\s+/i.test(answer);
  const hasClosing = /(best|thanks|sincerely),/i.test(answer);
  let structure = 40;
  if (hasGreeting) structure += 20;
  if (hasClosing) structure += 20;
  if (paragraphs.length >= 3) structure += 20;
  structure = Math.min(100, structure);
  if (structure < 70) reasons.push('weak_structure');

  // Compliance: placeholders and word-count constraints
  let compliance = 100;
  if (wordCount < 180 || wordCount > 380) {
    compliance -= 25;
    reasons.push('word_count_non_compliant');
  }
  if (/\[(your name|my name|name|company name)\]/i.test(answer)) {
    compliance -= 40;
    reasons.push('placeholder_detected');
  }
  compliance = Math.max(0, compliance);

  const overall = Math.round(
    alignment * 0.3 +
    specificity * 0.25 +
    tone * 0.15 +
    structure * 0.15 +
    compliance * 0.15
  );
  const boundedOverall = reasons.includes('placeholder_detected') ? Math.min(overall, 70) : overall;

  return {
    overall: boundedOverall,
    alignment,
    specificity,
    tone,
    structure,
    compliance,
    reasons
  };
}

function blendQualityScores(
  heuristic: CoverLetterQualityScore,
  critic: LlmCriticScore | null,
  calibration: { calibratedOverall: number; biasAdjustment: number; datasetSize: number } | null
): CoverLetterQualityScore {
  if (!critic || !calibration) {
    return {
      ...heuristic,
      scoringMethod: 'heuristic_only',
      cappedByAgreement: false
    };
  }

  const agreementDelta = Math.abs(heuristic.overall - calibration.calibratedOverall);
  const agreementPassed =
    heuristic.overall >= QUALITY_AGREEMENT_FLOOR &&
    calibration.calibratedOverall >= QUALITY_AGREEMENT_FLOOR &&
    agreementDelta <= QUALITY_AGREEMENT_MAX_DELTA &&
    critic.evidence_grounding >= 80 &&
    critic.unsupported_claims.length === 0;

  const blendedOverall = Math.round(
    heuristic.overall * 0.55 + calibration.calibratedOverall * 0.45
  );
  const finalOverall = agreementPassed
    ? blendedOverall
    : Math.min(blendedOverall, MAX_SCORE_WITHOUT_AGREEMENT);

  const blendedReasons = [...new Set([
    ...heuristic.reasons,
    ...critic.reasons,
    ...(agreementPassed ? [] : ['heuristic_critic_disagreement_cap'])
  ])];

  return {
    overall: finalOverall,
    alignment: Math.round((heuristic.alignment + critic.alignment) / 2),
    specificity: Math.round((heuristic.specificity + critic.specificity) / 2),
    tone: Math.round((heuristic.tone + critic.tone) / 2),
    structure: Math.round((heuristic.structure + critic.structure) / 2),
    compliance: Math.round((heuristic.compliance + critic.compliance) / 2),
    reasons: blendedReasons,
    scoringMethod: 'hybrid',
    cappedByAgreement: !agreementPassed,
    critic: {
      rawOverall: critic.overall,
      calibratedOverall: calibration.calibratedOverall,
      biasAdjustment: calibration.biasAdjustment,
      datasetSize: calibration.datasetSize,
      agreementDelta,
      agreementPassed,
      reasons: critic.reasons,
      unsupported_claims: critic.unsupported_claims,
      evidence_grounding: critic.evidence_grounding
    }
  };
}

function buildQualityRepairPrompt(
  answer: string,
  reasons: string[],
  candidateName: string | null,
  alignmentGuidance: string,
  identityGuardrails: string,
  ragContextBlock: string
): string {
  return `Revise the cover letter below to fix quality defects while preserving factual accuracy.

Defects to fix:
${(reasons.length > 0 ? reasons : ['improve overall quality and alignment']).map((reason, idx) => `${idx + 1}. ${reason}`).join('\n')}

Rules:
- Keep it plain text and professional.
- Keep it between 220 and 320 words.
- Do not invent any facts not present in the provided context.
- Use a specific greeting and a clear sign-off.
- Avoid generic AI phrases and placeholders.
- Do not include contact headers or address blocks.
- Use candidate name "${candidateName || 'from resume'}" in sign-off.

ORIGINAL LETTER:
${answer}

${alignmentGuidance}
${identityGuardrails}
${ragContextBlock ? `\nRETRIEVED EVIDENCE:\n${ragContextBlock}\n` : ''}`;
}

function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function toScore(value: unknown, fallback = 0): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function normalizeLlmCritic(rawText: string): LlmCriticScore | null {
  const jsonText = extractJsonObject(rawText);
  if (!jsonText) return null;
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    return {
      overall: toScore(parsed.overall, 0),
      alignment: toScore(parsed.alignment, 0),
      specificity: toScore(parsed.specificity, 0),
      tone: toScore(parsed.tone, 0),
      structure: toScore(parsed.structure, 0),
      compliance: toScore(parsed.compliance, 0),
      evidence_grounding: toScore(parsed.evidence_grounding, 0),
      unsupported_claims: Array.isArray(parsed.unsupported_claims)
        ? parsed.unsupported_claims.filter((x): x is string => typeof x === 'string').slice(0, 8)
        : [],
      reasons: Array.isArray(parsed.reasons)
        ? parsed.reasons.filter((x): x is string => typeof x === 'string').slice(0, 12)
        : []
    };
  } catch {
    return null;
  }
}

function buildCriticPrompt(input: {
  letter: string;
  requirements: string[];
  proofPoints: string[];
  ragEvidence: Array<Record<string, unknown>>;
}): string {
  const reqBlock = input.requirements.map((r, i) => `${i + 1}. ${r}`).join('\n');
  const proofBlock = input.proofPoints.map((p, i) => `${i + 1}. ${p}`).join('\n');
  const evidenceBlock = input.ragEvidence
    .slice(0, 6)
    .map((e, i) => `${i + 1}. ${(e.snippet as string) || ''}`)
    .join('\n');

  return `You are a strict cover letter quality auditor.
Score this letter with strict standards. Be conservative.

Return ONLY valid JSON with this exact schema:
{
  "overall": 0,
  "alignment": 0,
  "specificity": 0,
  "tone": 0,
  "structure": 0,
  "compliance": 0,
  "evidence_grounding": 0,
  "unsupported_claims": [],
  "reasons": []
}

Scoring guidance:
- alignment: how directly letter matches JD requirements.
- specificity: concrete metrics/achievements vs generic claims.
- tone: human, professional, non-cliche voice.
- structure: coherent opening/body/closing and readability.
- compliance: format and rule adherence (no placeholders/fabrication).
- evidence_grounding: claims supported by resume/evidence context.
- overall: strict weighted summary.

Job requirements:
${reqBlock || 'None provided'}

Resume proof points:
${proofBlock || 'None provided'}

Retrieved evidence snippets:
${evidenceBlock || 'None provided'}

Letter to evaluate:
${input.letter}`;
}

export const POST: RequestHandler = async (event) => {
  let requestBody: any = {};
  let auth: any = null;

  try {
    // Check authentication and permission
    auth = await requirePermission(event, 'cover_letter');

    requestBody = await event.request.json();
    const resumeSource = String(event.request.headers.get('x-resume-source') || '').trim();
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
      retrievalConfig,
      contact_profile,
      strictQuality = false,
      qualityThreshold = DEFAULT_QUALITY_THRESHOLD,
      strictQualityFailHard = false,
      strictQualityRetries = DEFAULT_STRICT_QUALITY_RETRIES
    } = requestBody;

    // FinalBoss manual flows must explicitly declare canonical managed resume source.
    if (platform === 'manual' && resumeSource !== 'finalboss-managed') {
      return json(
        {
          success: false,
          error: 'Manual cover-letter requests must use canonical FinalBoss managed resume source'
        },
        { status: 400 }
      );
    }

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

    const payloadErrors = validatePayloadGuardrails({
      body: requestBody,
      resumeText: resume_text,
      jobDetails: job_details,
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

    // Check token balance before processing (skip for admin users)
    const isAdmin = auth.user.userType === 'admin';
    const tokenService = await TokenService.create();
    if (!isAdmin) {
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
          contact_profile,
          resumeHash: crypto.createHash('sha256').update(String(resume_text)).digest('hex'),
          strictQuality: Boolean(strictQuality),
          qualityThreshold: Number(qualityThreshold) || DEFAULT_QUALITY_THRESHOLD
        })
      )
      .digest('hex');
    const ragEnabled = RAG_CONFIG.enabled && useRag !== false;
    let retrievalStats: Record<string, unknown> = {};
    let evidence: Array<Record<string, unknown>> = [];
    let warning: string | undefined;

    if (ragEnabled && !strictQuality) {
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
        const retrievalDocTypes = Array.isArray(retrievalConfig?.docTypes) && retrievalConfig.docTypes.length > 0
          ? retrievalConfig.docTypes
          : DEFAULT_COVER_LETTER_RETRIEVAL_DOC_TYPES;
        const retrievalStart = Date.now();
        let retrieval = await retrievalService.retrieve(
          userObjectId,
          `Generate tailored cover letter for ${job_title || ''} at ${company || ''}\n${typeof job_details === 'string' ? job_details : JSON.stringify(job_details)}`,
          {
            profileId,
            jobId: effectiveJobId,
            docTypes: retrievalDocTypes,
            topK: retrievalConfig?.topK,
            initialK: retrievalConfig?.initialK,
            maxContextTokens: retrievalConfig?.maxContextTokens
          }
        );

        // Self-healing: if user provided resume text but RAG has no chunks yet,
        // ingest the resume and retry retrieval once.
        if (retrieval.chunks.length === 0 && String(resume_text || '').trim().length > 0) {
          try {
            const ingestionService = new IngestionService(db);
            await ingestionService.ingestTextDocument({
              userId: userObjectId,
              profileId,
              title: 'runtime_resume_context.docx',
              docType: 'resume',
              source: 'system',
              text: String(resume_text),
              mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              profileVersion
            });

            retrieval = await retrievalService.retrieve(
              userObjectId,
              `Generate tailored cover letter for ${job_title || ''} at ${company || ''}\n${typeof job_details === 'string' ? job_details : JSON.stringify(job_details)}`,
              {
                profileId,
                jobId: effectiveJobId,
                docTypes: retrievalDocTypes,
                topK: retrievalConfig?.topK,
                initialK: retrievalConfig?.initialK,
                maxContextTokens: retrievalConfig?.maxContextTokens
              }
            );
            warning = 'RAG had no chunks; auto-ingested resume text and retried retrieval.';
          } catch (ingestError) {
            warning = `RAG auto-ingestion failed; fallback used: ${ingestError instanceof Error ? ingestError.message : 'unknown error'}`;
          }
        }

        const filteredChunks = retrieval.chunks.filter((c) =>
          DEFAULT_COVER_LETTER_RETRIEVAL_DOC_TYPES.includes(c.docType)
        );
        const selectedChunks = filteredChunks.length > 0 ? filteredChunks : retrieval.chunks;

        if (retrieval.chunks.length > 0 && filteredChunks.length === 0) {
          warning = 'Retrieved chunks were not cover-letter-safe doc types; fallback prompting used.';
        }

        ragContextBlock = selectedChunks
          .map((c, index) => `[${index + 1}] (score=${c.score.toFixed(3)}, docType=${c.docType})\n${c.text}`)
          .join('\n\n');
        evidence = selectedChunks.map((c) => ({
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
          topK: retrievalConfig?.topK ?? RAG_CONFIG.topK,
          selectedDocTypes: retrievalDocTypes,
          filteredOutChunks: Math.max(0, retrieval.chunks.length - selectedChunks.length)
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

    const extractedRequirements = extractJobRequirements(job_details);
    const extractedProofPoints = extractResumeProofPoints(String(resume_text));
    const contactProfile = normalizeContactProfile(contact_profile);
    const candidateName = contactProfile.full_name || extractCandidateName(String(resume_text));
    const authoritativeResume = String(resume_text).slice(0, 5000);
    const alignmentGuidance = buildAlignmentGuidance(job_details, String(resume_text));
    const identityGuardrails = `IDENTITY + FORMAT RULES (MANDATORY):
- Candidate name must be: ${candidateName || 'Use the real candidate name from the provided resume text; do not invent one.'}
- Candidate email: ${contactProfile.email || 'Use only if explicitly requested and available from trusted context.'}
- Candidate phone: ${contactProfile.phone || 'Use only if explicitly requested and available from trusted context.'}
- Candidate LinkedIn URL: ${contactProfile.linkedin_url || 'Use only if explicitly requested and available from trusted context.'}
- Do NOT include fake contact header/address blocks.
- Do NOT output placeholders like [Company Name], [Date], [Your Name], [Hiring Manager].
- Plain text only.`;
    const authoritativeResumeBlock = `AUTHORITATIVE RESUME TEXT (source of truth for identity and achievements):
${authoritativeResume}`;

    if (prompt) {
      // User provided their own prompt - use it as the main instruction
      fullPrompt = `${prompt}

${alignmentGuidance}
${identityGuardrails}

${ragContextBlock ? `RETRIEVED EVIDENCE (USE THIS FIRST):\n${ragContextBlock}\n` : ''}
${authoritativeResumeBlock}

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

${alignmentGuidance}
${identityGuardrails}

${ragContextBlock ? `RETRIEVED EVIDENCE:\n${ragContextBlock}\n` : ''}
${authoritativeResumeBlock}

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

    let finalResult = result;
    const initialAnswer = String(result.answer || '').trim();
    const quality = evaluateDraftQuality(initialAnswer);
    if (quality.needsRetry && initialAnswer.length > 0) {
      const repairPrompt = buildQualityRepairPrompt(
        initialAnswer,
        quality.reasons,
        candidateName,
        alignmentGuidance,
        identityGuardrails,
        ragContextBlock
      );

      const retryResult = await multiProvider.querySingle(
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
                evidence
              }
            }
          : undefined
      );

      if (retryResult.success && retryResult.answer) {
        finalResult = retryResult;
        warning = warning
          ? `${warning} Quality-pass rewrite applied.`
          : 'Quality-pass rewrite applied.';
      }
    }

    const parsedThreshold = Number.isFinite(Number(qualityThreshold))
      ? Math.max(0, Math.min(100, Number(qualityThreshold)))
      : DEFAULT_QUALITY_THRESHOLD;
    const maxStrictRetries = Number.isFinite(Number(strictQualityRetries))
      ? Math.max(0, Math.min(3, Number(strictQualityRetries)))
      : DEFAULT_STRICT_QUALITY_RETRIES;

    const evaluateQualityForCurrentDraft = async (): Promise<CoverLetterQualityScore> => {
      const letter = String(finalResult.answer || '');
      const heuristicScore = scoreCoverLetterQuality(
        letter,
        extractedRequirements,
        extractedProofPoints
      );

      const criticPrompt = buildCriticPrompt({
        letter,
        requirements: extractedRequirements,
        proofPoints: extractedProofPoints,
        ragEvidence: evidence
      });
      let criticScore: LlmCriticScore | null = null;
      let criticCalibration: { calibratedOverall: number; biasAdjustment: number; datasetSize: number } | null = null;
      try {
        const criticResult = await multiProvider.querySingle(
          auth.user.email,
          criticPrompt,
          useAi,
          undefined,
          {
            prebuiltPrompt: criticPrompt,
            disableAutoDocuments: true
          }
        );
        if (criticResult.success && criticResult.answer) {
          criticScore = normalizeLlmCritic(String(criticResult.answer));
          if (criticScore) {
            criticCalibration = calibrateCriticOverall(criticScore.overall);
          }
        }
      } catch {
        // Non-fatal: if critic fails, keep heuristic score only.
      }

      return blendQualityScores(heuristicScore, criticScore, criticCalibration);
    };

    let qualityScore = await evaluateQualityForCurrentDraft();
    let strictRetriesUsed = 0;

    while (strictQuality && qualityScore.overall < parsedThreshold && strictRetriesUsed < maxStrictRetries) {
      const strictRepairPrompt = buildQualityRepairPrompt(
        String(finalResult.answer || ''),
        [...qualityScore.reasons, `overall_below_threshold_${parsedThreshold}`],
        candidateName,
        alignmentGuidance,
        identityGuardrails,
        ragContextBlock
      );

      const strictRetryResult = await multiProvider.querySingle(
        auth.user.email,
        strictRepairPrompt,
        useAi,
        useRagPrompt ? undefined : resume_text,
        useRagPrompt
          ? {
              prebuiltPrompt: strictRepairPrompt,
              disableAutoDocuments: true,
              contextSnapshotId: ragContextSnapshotId,
              retrievalMetadata: {
                retrievalStats,
                evidence
              }
            }
          : undefined
      );

      strictRetriesUsed += 1;
      if (!strictRetryResult.success || !strictRetryResult.answer) break;
      finalResult = strictRetryResult;
      qualityScore = await evaluateQualityForCurrentDraft();
    }

    if (strictQuality && qualityScore.overall < parsedThreshold) {
      const strictWarning = `Strict quality target not met (${qualityScore.overall}/${parsedThreshold})`;
      warning = warning ? `${warning} ${strictWarning}` : strictWarning;
      if (strictQualityFailHard) {
        return json(
          {
            success: false,
            error: strictWarning,
            qualityScore
          },
          { status: 422 }
        );
      }
    }

    const processingTime = Date.now() - startTime;
    const meta = finalResult.metadata;
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

      // Deduct tokens after successful generation (skip for admin users)
      if (!isAdmin) {
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
            data: finalResult.answer
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
          },
          quality: qualityScore
        };

        if (!jobRecord.application) {
          // Create new application (embedded)
          await jobModel.createApplication(jobRecord._id!, {
            status: 'pending',
            coverLetter: finalResult.answer,
            apiCalls: [apiCallRecord],
            automationLogs: []
          });
        } else {
          // Update existing application
          await jobModel.addApiCall(jobRecord._id!, apiCallRecord);
          await jobModel.updateApplication(jobRecord._id!, {
            coverLetter: finalResult.answer
          });
        }
      }
    } catch (trackingError) {
      console.error('Job tracking error:', trackingError);
      // Don't fail the request if tracking fails
    }

    // Get final token balance (in case deduction happened in tracking block)
    const finalBalance = await tokenService.getBalance(userObjectId);

    if (ragEnabled && finalResult.answer) {
      await qaCacheModel.upsert({
        userId: userObjectId,
        profileId,
        jobId: effectiveJobId,
        questionHash,
        promptVersion,
        profileVersion,
        answer: finalResult.answer,
        retrievalStats,
        evidence,
        validationStatus: 'valid',
        ttlHours: RAG_CONFIG.cacheTtlHours
      });
    }

    // Return cover_letter, job_id, and token usage info (for clients to save and send to job-applications)
    return json({
      cover_letter: finalResult.answer,
      job_id,
      tokensUsed: TOKEN_COST_COVER_LETTER,
      actualTokensUsed: tokensUsed,
      inputTokens,
      outputTokens,
      remainingBalance: finalBalance,
      retrievalStats,
      evidence,
      qualityScore,
      qualityControl: {
        strictQuality: Boolean(strictQuality),
        qualityThreshold: parsedThreshold,
        strictRetriesUsed
      },
      contactProfileUsed: {
        full_name: candidateName || '',
        email: contactProfile.email || '',
        phone: contactProfile.phone || '',
        linkedin_url: contactProfile.linkedin_url || ''
      },
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
