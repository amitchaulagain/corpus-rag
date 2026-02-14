import { RAG_CONFIG } from '$lib/rag-config';

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

function hashToken(token: string): number {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

function normalize(vector: number[]): number[] {
  const mag = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (mag === 0) return vector;
  return vector.map((value) => value / mag);
}

export class EmbeddingService {
  constructor(private dimensions = RAG_CONFIG.embeddingDimensions) {}

  embed(text: string): number[] {
    const vector = new Array(this.dimensions).fill(0);
    const tokens = tokenize(text);
    if (tokens.length === 0) return vector;

    for (const token of tokens) {
      const idx = hashToken(token) % this.dimensions;
      vector[idx] += 1;
    }

    return normalize(vector);
  }

  embedBatch(texts: string[]): number[][] {
    return texts.map((text) => this.embed(text));
  }

  cosineSimilarity(a: number[], b: number[]): number {
    const size = Math.min(a.length, b.length);
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < size; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    if (magA === 0 || magB === 0) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }
}
