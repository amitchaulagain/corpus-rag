import crypto from 'crypto';
import { ObjectId, type Db } from 'mongodb';
import { RagDocumentModel, type RagDocumentType, type RagDocumentSource } from '$lib/models/rag-document';
import { RagChunkModel } from '$lib/models/rag-chunk';
import { chunkText } from './text-chunker';
import { EmbeddingService } from './embedding-service';

export interface IngestDocumentInput {
  userId: ObjectId;
  profileId?: string;
  title: string;
  docType: RagDocumentType;
  source: RagDocumentSource;
  text: string;
  localPath?: string;
  mimeType?: string;
  jobId?: string;
  metadata?: Record<string, unknown>;
  profileVersion?: string;
}

export interface IngestResult {
  documentId: ObjectId;
  fileHash: string;
  chunksInserted: number;
}

export class IngestionService {
  private documentModel: RagDocumentModel;
  private chunkModel: RagChunkModel;
  private embeddingService: EmbeddingService;

  constructor(db: Db) {
    this.documentModel = new RagDocumentModel(db);
    this.chunkModel = new RagChunkModel(db);
    this.embeddingService = new EmbeddingService();
  }

  async ingestTextDocument(input: IngestDocumentInput): Promise<IngestResult> {
    const normalizedText = input.text.trim();
    const fileHash = crypto.createHash('sha256').update(normalizedText).digest('hex');
    const chunks = chunkText(normalizedText);
    const embeddings = this.embeddingService.embedBatch(chunks.map((chunk) => chunk.text));

    const document = await this.documentModel.upsertByHash({
      userId: input.userId,
      profileId: input.profileId,
      docType: input.docType,
      source: input.source,
      title: input.title,
      localPath: input.localPath,
      mimeType: input.mimeType,
      fileHash,
      jobId: input.jobId,
      metadata: input.metadata,
      profileVersion: input.profileVersion
    });

    if (!document._id) {
      throw new Error('Failed to create or load RAG document id');
    }

    const chunksInserted = await this.chunkModel.replaceDocumentChunks({
      userId: input.userId,
      profileId: input.profileId,
      documentId: document._id,
      docType: input.docType,
      jobId: input.jobId,
      chunks: chunks.map((chunk, index) => ({
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
        keywords: chunk.keywords,
        tokenCount: chunk.tokenCount,
        chunkHash: chunk.chunkHash,
        embedding: embeddings[index] ?? [],
        metadata: {
          title: input.title,
          source: input.source
        }
      }))
    });

    return {
      documentId: document._id,
      fileHash,
      chunksInserted
    };
  }
}
