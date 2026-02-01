// Usage Tracking Model
import { ObjectId, type Db } from 'mongodb';

export interface UsageRecord {
  _id?: ObjectId;
  userId: ObjectId;
  endpoint: string; // 'cover_letter', 'resume', 'questionAndAnswers'
  jobId?: string;
  aiProvider: string; // 'deepseek-chat', 'claude-sonnet', 'gemini-flash'
  tokensUsed: number; // AI tokens consumed
  costUsd: number; // Estimated cost in USD
  success: boolean;
  errorMessage?: string;
  timestamp: Date;
  metadata?: {
    processingTime?: number;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface UsageSummary {
  totalCalls: number;
  totalTokens: number;
  totalCost: number;
  byEndpoint: {
    [endpoint: string]: {
      calls: number;
      tokens: number;
      cost: number;
    };
  };
  byProvider: {
    [provider: string]: {
      calls: number;
      tokens: number;
      cost: number;
    };
  };
}

export class UsageModel {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async track(record: Omit<UsageRecord, '_id' | 'timestamp'>): Promise<UsageRecord> {
    const usage: UsageRecord = {
      ...record,
      timestamp: new Date()
    };

    const result = await this.db.collection<UsageRecord>('usage').insertOne(usage);
    return { ...usage, _id: result.insertedId };
  }

  async getUserUsage(
    userId: string | ObjectId,
    startDate?: Date,
    endDate?: Date
  ): Promise<UsageRecord[]> {
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const query: any = { userId: userObjectId };

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = startDate;
      if (endDate) query.timestamp.$lte = endDate;
    }

    return await this.db
      .collection<UsageRecord>('usage')
      .find(query)
      .sort({ timestamp: -1 })
      .toArray();
  }

  async getUserSummary(
    userId: string | ObjectId,
    startDate?: Date,
    endDate?: Date
  ): Promise<UsageSummary> {
    const records = await this.getUserUsage(userId, startDate, endDate);

    const summary: UsageSummary = {
      totalCalls: records.length,
      totalTokens: 0,
      totalCost: 0,
      byEndpoint: {},
      byProvider: {}
    };

    for (const record of records) {
      summary.totalTokens += record.tokensUsed;
      summary.totalCost += record.costUsd;

      // By endpoint
      if (!summary.byEndpoint[record.endpoint]) {
        summary.byEndpoint[record.endpoint] = { calls: 0, tokens: 0, cost: 0 };
      }
      summary.byEndpoint[record.endpoint].calls++;
      summary.byEndpoint[record.endpoint].tokens += record.tokensUsed;
      summary.byEndpoint[record.endpoint].cost += record.costUsd;

      // By provider
      if (!summary.byProvider[record.aiProvider]) {
        summary.byProvider[record.aiProvider] = { calls: 0, tokens: 0, cost: 0 };
      }
      summary.byProvider[record.aiProvider].calls++;
      summary.byProvider[record.aiProvider].tokens += record.tokensUsed;
      summary.byProvider[record.aiProvider].cost += record.costUsd;
    }

    return summary;
  }

  // Check if user has exceeded free tier limits
  async checkFreeTierLimit(
    userId: string | ObjectId,
    endpoint: string,
    limits: { maxCalls?: number; maxTokens?: number }
  ): Promise<{ allowed: boolean; current: { calls: number; tokens: number } }> {
    // Get current month usage
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const records = await this.getUserUsage(userId, startOfMonth);
    const endpointRecords = records.filter((r) => r.endpoint === endpoint);

    const current = {
      calls: endpointRecords.length,
      tokens: endpointRecords.reduce((sum, r) => sum + r.tokensUsed, 0)
    };

    let allowed = true;

    if (limits.maxCalls && current.calls >= limits.maxCalls) {
      allowed = false;
    }

    if (limits.maxTokens && current.tokens >= limits.maxTokens) {
      allowed = false;
    }

    return { allowed, current };
  }

  async getRecentUsage(userId: string | ObjectId, limit: number = 10): Promise<UsageRecord[]> {
    const userObjectId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    return await this.db
      .collection<UsageRecord>('usage')
      .find({ userId: userObjectId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }
}
