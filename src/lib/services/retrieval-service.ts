import type { Db, ObjectId } from 'mongodb';
import { RAG_CONFIG } from '$lib/rag-config';
import type { RagChunk } from '$lib/models/rag-chunk';
import { EmbeddingService } from './embedding-service';

export interface RetrievalOptions {
  profileId?: string;
  jobId?: string;
  docTypes?: string[];
  topK?: number;
  initialK?: number;
  maxContextTokens?: number;
}

export interface RetrievedChunk {
  chunkId: string;
  docId: string;
  docType: string;
  score: number;
  text: string;
  tokenCount: number;
  keywords: string[];
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  stats: {
    initialCandidates: number;
    selectedChunks: number;
    contextTokens: number;
    elapsedMs: number;
  };
}

function keywordOverlapScore(query: string, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const queryTokens = new Set(
    query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2)
  );
  if (queryTokens.size === 0) return 0;
  let hits = 0;
  for (const keyword of keywords) {
    if (queryTokens.has(keyword.toLowerCase())) hits += 1;
  }
  return hits / Math.max(1, queryTokens.size);
}

export class RetrievalService {
  private embeddingService = new EmbeddingService();

  constructor(private db: Db) {}

  async retrieve(userId: ObjectId, query: string, options: RetrievalOptions = {}): Promise<RetrievalResult> {
    const start = Date.now();
    const profileId = options.profileId ?? 'default';
    const initialK = options.initialK ?? RAG_CONFIG.initialK;
    const topK = options.topK ?? RAG_CONFIG.topK;
    const maxContextTokens = options.maxContextTokens ?? RAG_CONFIG.maxContextTokens;

    const filter: Record<string, unknown> = {
      userId,
      profileId
    };

    if (options.jobId) {
      filter.$or = [
        { jobId: options.jobId },
        { jobId: { $exists: false } },
        { jobId: null },
        { jobId: '' }
      ];
    }
    if (options.docTypes && options.docTypes.length > 0) {
      filter.docType = { $in: options.docTypes };
    }

    const candidates = await this.db
      .collection<RagChunk>('document_chunks')
      .find(filter)
      .limit(Math.max(initialK * 4, 100))
      .toArray();

    const queryEmbedding = this.embeddingService.embed(query);

    const scored = candidates
      .map((chunk) => {
        const vecScore = this.embeddingService.cosineSimilarity(queryEmbedding, chunk.embedding ?? []);
        const kwScore = keywordOverlapScore(query, chunk.keywords ?? []);
        const recencyBoost = Math.max(
          0,
          1 - (Date.now() - new Date(chunk.updatedAt).getTime()) / (1000 * 60 * 60 * 24 * 180)
        );
        const score = vecScore * 0.7 + kwScore * 0.2 + recencyBoost * 0.1;
        return { chunk, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, initialK);

    const selected: RetrievedChunk[] = [];
    const perDocCount = new Map<string, number>();
    let tokenBudget = 0;

    for (const { chunk, score } of scored) {
      const docId = String(chunk.documentId);
      const used = perDocCount.get(docId) ?? 0;
      if (used >= RAG_CONFIG.maxChunksPerDocument) continue;
      if (tokenBudget + chunk.tokenCount > maxContextTokens) continue;

      selected.push({
        chunkId: String(chunk._id),
        docId,
        docType: chunk.docType,
        score,
        text: chunk.text,
        tokenCount: chunk.tokenCount,
        keywords: chunk.keywords
      });
      tokenBudget += chunk.tokenCount;
      perDocCount.set(docId, used + 1);
      if (selected.length >= topK) break;
    }

    return {
      chunks: selected,
      stats: {
        initialCandidates: candidates.length,
        selectedChunks: selected.length,
        contextTokens: tokenBudget,
        elapsedMs: Date.now() - start
      }
    };
  }
}
