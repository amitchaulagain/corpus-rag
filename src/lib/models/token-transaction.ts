// Token Transaction Model and Types
import { ObjectId, type Db } from 'mongodb';

export type TransactionType = 'purchase' | 'usage' | 'refund' | 'bonus' | 'adjustment';

export interface TokenTransaction {
  _id?: ObjectId;
  userId: ObjectId;
  
  // Transaction Details
  type: TransactionType;
  amount: number;                    // Positive for credit, negative for debit
  
  // Context
  orderId?: ObjectId;                // If related to an order
  jobId?: ObjectId;                  // If related to a job application
  endpoint?: string;                 // API endpoint that consumed tokens
  aiProvider?: string;               // AI provider used (e.g., 'deepseek-chat')
  
  // Token Conversion
  tokensUsed?: number;               // Tokens used (user tokens) - for usage type
  deepseekTokensUsed?: number;       // DeepSeek tokens consumed (tokensUsed * 0.5)
  
  // Balance Tracking
  balanceBefore: number;             // Token balance before transaction
  balanceAfter: number;              // Token balance after transaction
  
  // Metadata
  description: string;               // Human-readable description
  metadata?: Record<string, any>;
  
  // Timestamps
  createdAt: Date;
}

export class TokenTransactionModel {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async create(transactionData: Omit<TokenTransaction, '_id' | 'createdAt'>): Promise<TokenTransaction> {
    const transaction: TokenTransaction = {
      ...transactionData,
      createdAt: new Date()
    };

    const result = await this.db.collection<TokenTransaction>('token_transactions').insertOne(transaction);
    return { ...transaction, _id: result.insertedId };
  }

  async findById(id: string | ObjectId): Promise<TokenTransaction | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return await this.db.collection<TokenTransaction>('token_transactions').findOne({ _id: objectId });
  }

  async findByUserId(
    userId: string | ObjectId, 
    options?: { 
      type?: TransactionType; 
      limit?: number; 
      skip?: number;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<TokenTransaction[]> {
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const query: any = { userId: objectId };

    if (options?.type) {
      query.type = options.type;
    }

    if (options?.startDate || options?.endDate) {
      query.createdAt = {};
      if (options.startDate) {
        query.createdAt.$gte = options.startDate;
      }
      if (options.endDate) {
        query.createdAt.$lte = options.endDate;
      }
    }

    let cursor = this.db.collection<TokenTransaction>('token_transactions')
      .find(query)
      .sort({ createdAt: -1 });

    if (options?.skip) {
      cursor = cursor.skip(options.skip);
    }

    if (options?.limit) {
      cursor = cursor.limit(options.limit);
    }

    return await cursor.toArray();
  }

  async findByOrderId(orderId: string | ObjectId): Promise<TokenTransaction[]> {
    const objectId = typeof orderId === 'string' ? new ObjectId(orderId) : orderId;
    return await this.db.collection<TokenTransaction>('token_transactions')
      .find({ orderId: objectId })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async findByJobId(jobId: string | ObjectId): Promise<TokenTransaction[]> {
    const objectId = typeof jobId === 'string' ? new ObjectId(jobId) : jobId;
    return await this.db.collection<TokenTransaction>('token_transactions')
      .find({ jobId: objectId })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async count(query: any = {}): Promise<number> {
    return await this.db.collection<TokenTransaction>('token_transactions').countDocuments(query);
  }

  // Get token usage statistics for a user
  async getUsageStats(userId: string | ObjectId, startDate?: Date, endDate?: Date): Promise<{
    totalPurchased: number;
    totalUsed: number;
    totalRefunded: number;
    totalAdjusted: number;
    byType: Record<TransactionType, number>;
  }> {
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const query: any = { userId: objectId };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = startDate;
      }
      if (endDate) {
        query.createdAt.$lte = endDate;
      }
    }

    const transactions = await this.db.collection<TokenTransaction>('token_transactions')
      .find(query)
      .toArray();

    const stats = {
      totalPurchased: 0,
      totalUsed: 0,
      totalRefunded: 0,
      totalAdjusted: 0,
      byType: {
        purchase: 0,
        usage: 0,
        refund: 0,
        bonus: 0,
        adjustment: 0
      } as Record<TransactionType, number>
    };

    for (const tx of transactions) {
      if (tx.type === 'purchase' || tx.type === 'bonus') {
        stats.totalPurchased += tx.amount;
      } else if (tx.type === 'usage') {
        stats.totalUsed += Math.abs(tx.amount);
      } else if (tx.type === 'refund') {
        stats.totalRefunded += tx.amount;
      } else if (tx.type === 'adjustment') {
        stats.totalAdjusted += tx.amount;
      }

      stats.byType[tx.type] += Math.abs(tx.amount);
    }

    return stats;
  }
}
