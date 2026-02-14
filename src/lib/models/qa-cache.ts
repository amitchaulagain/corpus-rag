import { ObjectId, type Db } from 'mongodb';

export interface QaCacheRecord {
  _id?: ObjectId;
  userId: ObjectId;
  profileId: string;
  jobId: string;
  questionHash: string;
  promptVersion: string;
  profileVersion: string;
  answer: string;
  retrievalStats?: Record<string, unknown>;
  evidence?: unknown;
  validationStatus?: 'valid' | 'repaired' | 'invalid';
  cacheVersion: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface UpsertQaCacheInput {
  userId: ObjectId;
  profileId?: string;
  jobId: string;
  questionHash: string;
  promptVersion: string;
  profileVersion: string;
  answer: string;
  retrievalStats?: Record<string, unknown>;
  evidence?: unknown;
  validationStatus?: 'valid' | 'repaired' | 'invalid';
  ttlHours?: number;
}

export class QaCacheModel {
  constructor(private db: Db) {}

  async get(input: {
    userId: ObjectId;
    profileId?: string;
    jobId: string;
    questionHash: string;
    promptVersion: string;
    profileVersion: string;
  }): Promise<QaCacheRecord | null> {
    return this.db.collection<QaCacheRecord>('qa_cache').findOne({
      userId: input.userId,
      profileId: input.profileId ?? 'default',
      jobId: input.jobId,
      questionHash: input.questionHash,
      promptVersion: input.promptVersion,
      profileVersion: input.profileVersion
    });
  }

  async upsert(input: UpsertQaCacheInput): Promise<void> {
    const now = new Date();
    const ttl = input.ttlHours ?? 24 * 14;
    const expiresAt = new Date(now.getTime() + ttl * 60 * 60 * 1000);

    await this.db.collection<QaCacheRecord>('qa_cache').updateOne(
      {
        userId: input.userId,
        profileId: input.profileId ?? 'default',
        jobId: input.jobId,
        questionHash: input.questionHash,
        promptVersion: input.promptVersion,
        profileVersion: input.profileVersion
      },
      {
        $set: {
          answer: input.answer,
          retrievalStats: input.retrievalStats ?? {},
          evidence: input.evidence,
          validationStatus: input.validationStatus ?? 'valid',
          cacheVersion: 1,
          updatedAt: now,
          expiresAt
        },
        $setOnInsert: {
          createdAt: now
        }
      },
      { upsert: true }
    );
  }
}
