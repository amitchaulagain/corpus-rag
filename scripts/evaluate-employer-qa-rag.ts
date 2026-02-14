import fs from 'fs/promises';
import path from 'path';
import { validateQuestionAnswers } from '../src/lib/services/rag-answer-validator';

interface EvalCase {
  id: string;
  userId: string;
  job_id: string;
  useAi: string;
  questions: Array<{ q: string; type?: string; opts?: string[] }>;
  resume_text: string;
  job_details?: unknown;
  prompt?: string;
}

async function loadFixtureCases(): Promise<EvalCase[]> {
  const fixturePath = process.env.RAG_EVAL_FIXTURE_PATH
    ? path.resolve(process.env.RAG_EVAL_FIXTURE_PATH)
    : path.resolve('generated-responses', 'rag-eval-fixtures.json');

  try {
    const raw = await fs.readFile(fixturePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as EvalCase[];
    return [];
  } catch {
    return [];
  }
}

async function main() {
  const baseUrl = process.env.RAG_EVAL_BASE_URL || 'http://localhost:5173';
  const authToken = process.env.RAG_EVAL_BEARER_TOKEN;
  if (!authToken) {
    throw new Error('RAG_EVAL_BEARER_TOKEN is required for evaluation');
  }

  const fixtures = await loadFixtureCases();
  if (fixtures.length === 0) {
    console.log('No eval fixtures found. Create generated-responses/rag-eval-fixtures.json first.');
    return;
  }

  let validCount = 0;
  let totalLatencyMs = 0;
  let totalTokens = 0;
  let cacheHits = 0;

  for (const fixture of fixtures) {
    const started = Date.now();
    const response = await fetch(`${baseUrl}/api/questionAndAnswers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        ...fixture,
        useRag: true
      })
    });

    const payload = await response.json();
    const elapsed = Date.now() - started;
    totalLatencyMs += elapsed;
    totalTokens += Number(payload?.actualTokensUsed || 0);
    if (payload?.cacheHit === true) cacheHits += 1;

    const result = validateQuestionAnswers(String(payload?.answers || ''), fixture.questions);
    if (result.valid) validCount += 1;

    console.log(
      `[${fixture.id}] status=${response.status} valid=${result.valid} latencyMs=${elapsed} tokens=${payload?.actualTokensUsed ?? 0}`
    );
  }

  const total = fixtures.length;
  console.log('\nRAG Employer Q/A Evaluation Summary');
  console.log(`Cases: ${total}`);
  console.log(`Format Validity: ${((validCount / total) * 100).toFixed(2)}%`);
  console.log(`Avg Latency: ${(totalLatencyMs / total).toFixed(1)}ms`);
  console.log(`Avg Tokens: ${(totalTokens / total).toFixed(1)}`);
  console.log(`Cache Hit Rate: ${((cacheHits / total) * 100).toFixed(2)}%`);
}

main().catch((error) => {
  console.error('Evaluation failed:', error);
  process.exit(1);
});
