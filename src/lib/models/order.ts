// Order Model and Types
import { ObjectId, type Db } from 'mongodb';

export type OrderStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';
export type PaymentMethod = 'card' | 'bank_transfer' | 'other';

export interface Order {
  _id?: ObjectId;
  userId: ObjectId;
  
  // Order Details
  orderNumber: string;               // Unique order number (e.g., "ORD-20250120-001")
  status: OrderStatus;
  
  // Plan & Tokens
  planId: string;                    // 'silver', 'gold', 'diamond'
  tokensPurchased: number;           // Total tokens purchased (including bonus)
  baseTokens: number;                // Base tokens from plan
  bonusTokens: number;               // Bonus tokens (if any)
  
  // Pricing
  amount: number;                    // Amount in cents
  currency: string;
  taxAmount?: number;                // Tax amount (if applicable)
  totalAmount: number;               // Total amount charged
  
  // Stripe Integration
  stripePaymentIntentId?: string;   // Stripe Payment Intent ID
  stripeCustomerId?: string;         // Stripe Customer ID
  stripeChargeId?: string;           // Stripe Charge ID
  stripeSessionId?: string;          // Stripe Checkout Session ID (if using Checkout)
  
  // Payment Details
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  
  // Metadata
  metadata?: Record<string, any>;    // Additional data
  notes?: string;                    // Admin notes
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  refundedAt?: Date;
}

export class OrderModel {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async create(orderData: Omit<Order, '_id' | 'createdAt' | 'updatedAt'>): Promise<Order> {
    const order: Order = {
      ...orderData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await this.db.collection<Order>('orders').insertOne(order);
    return { ...order, _id: result.insertedId };
  }

  async findByOrderNumber(orderNumber: string): Promise<Order | null> {
    return await this.db.collection<Order>('orders').findOne({ orderNumber });
  }

  async findById(id: string | ObjectId): Promise<Order | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return await this.db.collection<Order>('orders').findOne({ _id: objectId });
  }

  async findByUserId(userId: string | ObjectId, options?: { limit?: number; skip?: number; status?: OrderStatus }): Promise<Order[]> {
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const query: any = { userId: objectId };
    
    if (options?.status) {
      query.status = options.status;
    }

    let cursor = this.db.collection<Order>('orders').find(query).sort({ createdAt: -1 });
    
    if (options?.skip) {
      cursor = cursor.skip(options.skip);
    }
    
    if (options?.limit) {
      cursor = cursor.limit(options.limit);
    }

    return await cursor.toArray();
  }

  async findByStripePaymentIntentId(paymentIntentId: string): Promise<Order | null> {
    return await this.db.collection<Order>('orders').findOne({ stripePaymentIntentId: paymentIntentId });
  }

  async findByStripeSessionId(sessionId: string): Promise<Order | null> {
    return await this.db.collection<Order>('orders').findOne({ stripeSessionId: sessionId });
  }

  async findByStripeChargeId(chargeId: string): Promise<Order | null> {
    return await this.db.collection<Order>('orders').findOne({ stripeChargeId: chargeId });
  }

  async updateStatus(orderId: string | ObjectId, status: OrderStatus, paymentStatus?: PaymentStatus): Promise<void> {
    const objectId = typeof orderId === 'string' ? new ObjectId(orderId) : orderId;
    const update: any = { 
      status, 
      updatedAt: new Date() 
    };

    if (paymentStatus) {
      update.paymentStatus = paymentStatus;
    }

    if (status === 'completed') {
      update.completedAt = new Date();
    }

    if (status === 'refunded') {
      update.refundedAt = new Date();
    }

    await this.db.collection<Order>('orders').updateOne(
      { _id: objectId },
      { $set: update }
    );
  }

  async update(orderId: string | ObjectId, updates: Partial<Omit<Order, '_id' | 'createdAt'>>): Promise<void> {
    const objectId = typeof orderId === 'string' ? new ObjectId(orderId) : orderId;
    await this.db.collection<Order>('orders').updateOne(
      { _id: objectId },
      { $set: { ...updates, updatedAt: new Date() } }
    );
  }

  async findAll(options?: { 
    userId?: string | ObjectId; 
    status?: OrderStatus; 
    limit?: number; 
    skip?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Order[]> {
    const query: any = {};

    if (options?.userId) {
      const objectId = typeof options.userId === 'string' ? new ObjectId(options.userId) : options.userId;
      query.userId = objectId;
    }

    if (options?.status) {
      query.status = options.status;
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

    let cursor = this.db.collection<Order>('orders').find(query).sort({ createdAt: -1 });

    if (options?.skip) {
      cursor = cursor.skip(options.skip);
    }

    if (options?.limit) {
      cursor = cursor.limit(options.limit);
    }

    return await cursor.toArray();
  }

  async count(query: any = {}): Promise<number> {
    return await this.db.collection<Order>('orders').countDocuments(query);
  }

  // Generate unique order number
  static generateOrderNumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ORD-${dateStr}-${random}`;
  }
}
