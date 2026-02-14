export interface RagRuntimeConfig {
  enabled: boolean;
  maxContextTokens: number;
  topK: number;
  initialK: number;
  maxChunksPerDocument: number;
  retrievalTimeoutMs: number;
  embeddingDimensions: number;
  cacheTtlHours: number;
}

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const RAG_CONFIG: RagRuntimeConfig = {
  enabled: process.env.RAG_EMPLOYER_QA_ENABLED !== 'false',
  maxContextTokens: readIntEnv('RAG_MAX_CONTEXT_TOKENS', 4500),
  topK: readIntEnv('RAG_TOP_K', 6),
  initialK: readIntEnv('RAG_INITIAL_K', 20),
  maxChunksPerDocument: readIntEnv('RAG_MAX_CHUNKS_PER_DOCUMENT', 4),
  retrievalTimeoutMs: readIntEnv('RAG_RETRIEVAL_TIMEOUT_MS', 2500),
  embeddingDimensions: readIntEnv('RAG_EMBEDDING_DIMENSIONS', 128),
  cacheTtlHours: readIntEnv('RAG_CACHE_TTL_HOURS', 24 * 14)
};
