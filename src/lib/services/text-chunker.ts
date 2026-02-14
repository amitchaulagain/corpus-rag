import crypto from 'crypto';

export interface TextChunk {
  chunkIndex: number;
  text: string;
  keywords: string[];
  tokenCount: number;
  chunkHash: string;
}

export interface TextChunkerOptions {
  wordsPerChunk?: number;
  overlapWords?: number;
  minChunkLength?: number;
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'with', 'this', 'from', 'have', 'you', 'your', 'are', 'was', 'were',
  'will', 'would', 'could', 'should', 'can', 'not', 'but', 'about', 'into', 'onto', 'then', 'than',
  'our', 'their', 'they', 'them', 'its', 'it', 'in', 'on', 'at', 'to', 'of', 'a', 'an'
]);

function normalizeText(text: string): string {
  return text.replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function estimateTokenCount(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words * 1.3));
}

function extractKeywords(text: string, limit = 20): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));

  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

export function chunkText(text: string, options: TextChunkerOptions = {}): TextChunk[] {
  const wordsPerChunk = options.wordsPerChunk ?? 550;
  const overlapWords = options.overlapWords ?? 80;
  const minChunkLength = options.minChunkLength ?? 120;

  const normalized = normalizeText(text);
  if (!normalized) return [];

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length <= wordsPerChunk) {
    return [{
      chunkIndex: 0,
      text: normalized,
      keywords: extractKeywords(normalized),
      tokenCount: estimateTokenCount(normalized),
      chunkHash: crypto.createHash('sha256').update(normalized).digest('hex')
    }];
  }

  const chunks: TextChunk[] = [];
  let index = 0;
  let start = 0;

  while (start < words.length) {
    const end = Math.min(words.length, start + wordsPerChunk);
    const chunkWords = words.slice(start, end);
    const chunkTextValue = chunkWords.join(' ').trim();

    if (chunkTextValue.length >= minChunkLength || chunks.length === 0) {
      chunks.push({
        chunkIndex: index++,
        text: chunkTextValue,
        keywords: extractKeywords(chunkTextValue),
        tokenCount: estimateTokenCount(chunkTextValue),
        chunkHash: crypto.createHash('sha256').update(chunkTextValue).digest('hex')
      });
    }

    if (end >= words.length) break;
    start = Math.max(0, end - overlapWords);
  }

  return chunks;
}
