// Token Service - Handles all token-related operations
import { connectToDatabase, ObjectId } from '../db/mongodb';
import { UserModel } from '../models/user';
import { TokenTransactionModel, type TransactionType } from '../models/token-transaction';
import type { Db } from 'mongodb';

export interface TokenCheckResult {
  hasEnoughTokens: boolean;
  currentBalance: number;
  requiredTokens: number;
  remainingAfter: number;
}

export interface TokenUsageCost {
  coverLetter: number;      // 2 tokens
  resumeTailoring: number;  // 2 tokens
  qaGeneration: number;     // 1 token
}

export class TokenService {
  private db: Db;
  private userModel: UserModel;
  private transactionModel: TokenTransactionModel;

  // Token costs for different operations
  static readonly TOKEN_COSTS: TokenUsageCost = {
    coverLetter: 2,
    resumeTailoring: 2,
    qaGeneration: 1
  };

  // DeepSeek token conversion rate: 1 user token = 0.5 DeepSeek token
  static readonly DEEPSEEK_CONVERSION_RATE = 0.5;

  constructor(db?: Db) {
    // Allow injection of db for testing, or connect automatically
    this.db = db as Db;
    this.userModel = new UserModel(this.db);
    this.transactionModel = new TokenTransactionModel(this.db);
  }

  // Initialize with database connection
  static async create(): Promise<TokenService> {
    const db = await connectToDatabase();
    return new TokenService(db);
  }

  /**
   * Get user's current token balance
   */
  async getBalance(userId: string | ObjectId): Promise<number> {
    return await this.userModel.getTokenBalance(userId);
  }

  /**
   * Get comprehensive token information for a user
   */
  async getTokenInfo(userId: string | ObjectId): Promise<{
    tokenBalance: number;
    totalPurchased: number;
    totalUsed: number;
    lastPurchaseAt?: Date;
    lastUsageAt?: Date;
  }> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return {
      tokenBalance: user.tokenBalance ?? 0,
      totalPurchased: user.totalTokensPurchased ?? 0,
      totalUsed: user.totalTokensUsed ?? 0,
      lastPurchaseAt: user.lastTokenPurchaseAt,
      lastUsageAt: user.lastTokenUsageAt
    };
  }

  /**
   * Check if user has enough tokens for an operation
   */
  async checkTokens(userId: string | ObjectId, requiredTokens: number): Promise<TokenCheckResult> {
    const balance = await this.getBalance(userId);
    const hasEnough = balance >= requiredTokens;
    const remainingAfter = hasEnough ? balance - requiredTokens : balance;

    return {
      hasEnoughTokens: hasEnough,
      currentBalance: balance,
      requiredTokens,
      remainingAfter
    };
  }

  /**
   * Calculate tokens required for job application operations
   */
  static calculateRequiredTokens(options: {
    generateCoverLetter?: boolean;
    tailorResume?: boolean;
    generateQA?: boolean;
  }): number {
    let total = 0;

    if (options.generateCoverLetter) {
      total += TokenService.TOKEN_COSTS.coverLetter;
    }

    if (options.tailorResume) {
      total += TokenService.TOKEN_COSTS.resumeTailoring;
    }

    if (options.generateQA) {
      total += TokenService.TOKEN_COSTS.qaGeneration;
    }

    return total;
  }

  /**
   * Add tokens to user account (for purchases, bonuses, refunds, adjustments)
   */
  async addTokens(
    userId: string | ObjectId,
    amount: number,
    type: 'purchase' | 'bonus' | 'refund' | 'adjustment',
    options?: {
      orderId?: string | ObjectId;
      description?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<{ newBalance: number; transactionId: ObjectId }> {
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const balanceBefore = await this.getBalance(objectId);

    // Add tokens to user balance (atomic operation)
    await this.userModel.addTokens(objectId, amount);

    // Create transaction record
    const orderIdObj = options?.orderId 
      ? (typeof options.orderId === 'string' ? new ObjectId(options.orderId) : options.orderId)
      : undefined;

    const description = options?.description || 
      `${type === 'purchase' ? 'Purchased' : type === 'bonus' ? 'Bonus' : type === 'refund' ? 'Refunded' : 'Adjusted'} ${amount} tokens`;

    const transaction = await this.transactionModel.create({
      userId: objectId,
      type,
      amount,
      orderId: orderIdObj,
      balanceBefore,
      balanceAfter: balanceBefore + amount,
      description,
      metadata: options?.metadata
    });

    return {
      newBalance: balanceBefore + amount,
      transactionId: transaction._id as ObjectId
    };
  }

  /**
   * Deduct tokens from user account (for usage)
   */
  async deductTokens(
    userId: string | ObjectId,
    amount: number,
    options?: {
      jobId?: string | ObjectId;
      endpoint?: string;
      aiProvider?: string;
      description?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<{ success: boolean; newBalance: number; transactionId?: ObjectId; deepseekTokensUsed: number }> {
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const balanceBefore = await this.getBalance(objectId);

    // Check if user has enough tokens
    if (balanceBefore < amount) {
      return {
        success: false,
        newBalance: balanceBefore,
        deepseekTokensUsed: 0
      };
    }

    // Calculate DeepSeek tokens used
    const deepseekTokensUsed = amount * TokenService.DEEPSEEK_CONVERSION_RATE;

    try {
      // Deduct tokens from user balance (atomic operation with balance check)
      const success = await this.userModel.deductTokens(objectId, amount);
      
      if (!success) {
        // Double-check failed - balance changed between check and deduction
        const currentBalance = await this.getBalance(objectId);
        return {
          success: false,
          newBalance: currentBalance,
          deepseekTokensUsed: 0
        };
      }

      // Create transaction record
      const jobIdObj = options?.jobId 
        ? (typeof options.jobId === 'string' ? new ObjectId(options.jobId) : options.jobId)
        : undefined;

      const description = options?.description || 
        `Used ${amount} tokens${options?.endpoint ? ` for ${options.endpoint}` : ''}`;

      const transaction = await this.transactionModel.create({
        userId: objectId,
        type: 'usage',
        amount: -amount, // Negative for deduction
        jobId: jobIdObj,
        endpoint: options?.endpoint,
        aiProvider: options?.aiProvider,
        tokensUsed: amount,
        deepseekTokensUsed,
        balanceBefore,
        balanceAfter: balanceBefore - amount,
        description,
        metadata: options?.metadata
      });

      return {
        success: true,
        newBalance: balanceBefore - amount,
        transactionId: transaction._id,
        deepseekTokensUsed
      };
    } catch (error) {
      console.error('Error deducting tokens:', error);
      return {
        success: false,
        newBalance: balanceBefore,
        deepseekTokensUsed: 0
      };
    }
  }

  /**
   * Get transaction history for a user
   */
  async getTransactionHistory(
    userId: string | ObjectId,
    options?: {
      type?: TransactionType;
      limit?: number;
      skip?: number;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{
    transactions: any[];
    total: number;
  }> {
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    
    const transactions = await this.transactionModel.findByUserId(objectId, options);
    const total = await this.transactionModel.count({ userId: objectId });

    return {
      transactions,
      total
    };
  }

  /**
   * Get usage statistics for a user
   */
  async getUsageStats(
    userId: string | ObjectId,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalPurchased: number;
    totalUsed: number;
    totalRefunded: number;
    totalAdjusted: number;
    byType: Record<TransactionType, number>;
  }> {
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    return await this.transactionModel.getUsageStats(objectId, startDate, endDate);
  }
}
