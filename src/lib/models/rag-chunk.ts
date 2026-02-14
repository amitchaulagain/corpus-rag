import { ObjectId, type Db } from 'mongodb';
import type { RagDocumentType } from './rag-document';

export interface RagChunk {
  _id?: ObjectId;
  userId: ObjectId;
  profileId: string;
  documentId: ObjectId;
  docType: RagDocumentType;
  jobId?: string;
  chunkIndex: number;
  text: string;
  keywords: string[];
  tokenCount: number;
  embedding: number[];
  chunkHash: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertChunksInput {
  userId: ObjectId;
  profileId?: string;
  documentId: ObjectId;
  docType: RagDocumentType;
  jobId?: string;
  chunks: Array<{
    chunkIndex: number;
    text: string;
    keywords: string[];
    tokenCount: number;
    embedding: number[];
    chunkHash: string;
    metadata?: Record<string, unknown>;
  }>;
}

export class RagChunkModel {
  constructor(private db: Db) {}

  async replaceDocumentChunks(input: UpsertChunksInput): Promise<number> {
    const now = new Date();
    const profileId = input.profileId ?? 'default';
    await this.db.collection<RagChunk>('document_chunks').deleteMany({
      userId: input.userId,
      documentId: input.documentId
    });

    if (input.chunks.length === 0) return 0;

    const docs: RagChunk[] = input.chunks.map((chunk) => ({
      userId: input.userId,
      profileId,
      documentId: input.documentId,
      docType: input.docType,
      jobId: input.jobId,
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
      keywords: chunk.keywords,
      tokenCount: chunk.tokenCount,
      embedding: chunk.embedding,
      chunkHash: chunk.chunkHash,
      metadata: chunk.metadata ?? {},
      createdAt: now,
      updatedAt: now
    }));

    const result = await this.db.collection<RagChunk>('document_chunks').insertMany(docs, { ordered: false });
    return result.insertedCount;
  }

  async listByUser(userId: ObjectId, profileId = 'default'): Promise<RagChunk[]> {
    return this.db
      .collection<RagChunk>('document_chunks')
      .find({ userId, profileId })
      .sort({ updatedAt: -1 })
      .toArray();
  }
}
