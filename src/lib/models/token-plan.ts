// Token Plan Model and Types
import { ObjectId, type Db } from 'mongodb';

export type PlanId = 'silver' | 'gold' | 'diamond';

export interface TokenPlan {
  _id?: ObjectId;
  planId: PlanId;
  name: string;
  description: string;
  
  // Pricing
  price: number;                    // Price in cents (Stripe format)
  currency: string;                  // 'usd', 'aud', etc.
  tokensIncluded: number;            // Tokens included in this plan
  
  // Additional Features
  bonusTokens?: number;              // Bonus tokens (e.g., "Buy 1000, get 200 free")
  features: string[];                // Feature list for display
  
  // Stripe Integration
  stripePriceId?: string;            // Stripe Price ID for recurring (if needed)
  stripeProductId?: string;          // Stripe Product ID
  
  // Display & UI
  displayOrder: number;              // Order in UI (1, 2, 3)
  isPopular?: boolean;               // Highlight as "Popular"
  badge?: string;                    // "Best Value", "Most Popular", etc.
  
  // Status
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class TokenPlanModel {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async create(planData: Omit<TokenPlan, '_id' | 'createdAt' | 'updatedAt'>): Promise<TokenPlan> {
    const plan: TokenPlan = {
      ...planData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await this.db.collection<TokenPlan>('token_plans').insertOne(plan);
    return { ...plan, _id: result.insertedId };
  }

  async findByPlanId(planId: PlanId): Promise<TokenPlan | null> {
    return await this.db.collection<TokenPlan>('token_plans').findOne({ planId });
  }

  async findById(id: string | ObjectId): Promise<TokenPlan | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return await this.db.collection<TokenPlan>('token_plans').findOne({ _id: objectId });
  }

  async findAllActive(): Promise<TokenPlan[]> {
    return await this.db.collection<TokenPlan>('token_plans')
      .find({ isActive: true })
      .sort({ displayOrder: 1 })
      .toArray();
  }

  async findAll(): Promise<TokenPlan[]> {
    return await this.db.collection<TokenPlan>('token_plans')
      .find()
      .sort({ displayOrder: 1 })
      .toArray();
  }

  async update(planId: PlanId, updates: Partial<Omit<TokenPlan, '_id' | 'planId' | 'createdAt'>>): Promise<void> {
    await this.db.collection<TokenPlan>('token_plans').updateOne(
      { planId },
      { $set: { ...updates, updatedAt: new Date() } }
    );
  }

  async setActive(planId: PlanId, isActive: boolean): Promise<void> {
    await this.db.collection<TokenPlan>('token_plans').updateOne(
      { planId },
      { $set: { isActive, updatedAt: new Date() } }
    );
  }

  async delete(planId: PlanId): Promise<boolean> {
    const result = await this.db.collection<TokenPlan>('token_plans').deleteOne({ planId });
    return result.deletedCount > 0;
  }
}
