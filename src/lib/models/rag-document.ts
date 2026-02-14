import { ObjectId, type Db } from 'mongodb';

export type RagDocumentType =
  | 'resume'
  | 'cover_letter'
  | 'generic_question'
  | 'job_description'
  | 'receipt'
  | 'invoice'
  | 'other';

export type RagDocumentSource = 'upload' | 'generic_questions' | 'job_payload' | 'system';

export interface RagDocument {
  _id?: ObjectId;
  userId: ObjectId;
  profileId: string;
  docType: RagDocumentType;
  source: RagDocumentSource;
  title: string;
  localPath?: string;
  mimeType?: string;
  fileHash?: string;
  profileVersion: string;
  jobId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRagDocumentInput {
  userId: ObjectId;
  profileId?: string;
  docType: RagDocumentType;
  source: RagDocumentSource;
  title: string;
  localPath?: string;
  mimeType?: string;
  fileHash?: string;
  profileVersion?: string;
  jobId?: string;
  metadata?: Record<string, unknown>;
}

export class RagDocumentModel {
  constructor(private db: Db) {}

  async upsertByHash(input: CreateRagDocumentInput): Promise<RagDocument> {
    const now = new Date();
    const profileId = input.profileId ?? 'default';
    const profileVersion = input.profileVersion ?? now.toISOString();

    const baseDoc: RagDocument = {
      userId: input.userId,
      profileId,
      docType: input.docType,
      source: input.source,
      title: input.title,
      localPath: input.localPath,
      mimeType: input.mimeType,
      fileHash: input.fileHash,
      jobId: input.jobId,
      metadata: input.metadata ?? {},
      profileVersion,
      createdAt: now,
      updatedAt: now
    };

    if (input.fileHash) {
      const existing = await this.db.collection<RagDocument>('documents').findOne({
        userId: input.userId,
        fileHash: input.fileHash
      });

      if (existing?._id) {
        await this.db.collection<RagDocument>('documents').updateOne(
          { _id: existing._id },
          {
            $set: {
              ...baseDoc,
              createdAt: existing.createdAt,
              updatedAt: now
            }
          }
        );
        return {
          ...existing,
          ...baseDoc,
          createdAt: existing.createdAt,
          updatedAt: now
        };
      }
    }

    const result = await this.db.collection<RagDocument>('documents').insertOne(baseDoc);
    return {
      ...baseDoc,
      _id: result.insertedId
    };
  }

  async listByUser(userId: ObjectId, profileId = 'default'): Promise<RagDocument[]> {
    return this.db
      .collection<RagDocument>('documents')
      .find({ userId, profileId })
      .sort({ updatedAt: -1 })
      .toArray();
  }
}
