// Stripe Webhook Model and Types
import { ObjectId, type Db } from 'mongodb';

export interface StripeWebhook {
  _id?: ObjectId;
  stripeEventId: string;             // Stripe event ID (for idempotency)
  eventType: string;                 // 'payment_intent.succeeded', etc.
  payload: Record<string, any>;      // Full webhook payload
  processed: boolean;                // Whether we've processed this event
  processedAt?: Date;
  error?: string;                    // Error message if processing failed
  createdAt: Date;
}

export class StripeWebhookModel {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async create(webhookData: Omit<StripeWebhook, '_id' | 'createdAt'>): Promise<StripeWebhook> {
    const webhook: StripeWebhook = {
      ...webhookData,
      createdAt: new Date()
    };

    const result = await this.db.collection<StripeWebhook>('stripe_webhooks').insertOne(webhook);
    return { ...webhook, _id: result.insertedId };
  }

  async findByEventId(stripeEventId: string): Promise<StripeWebhook | null> {
    return await this.db.collection<StripeWebhook>('stripe_webhooks').findOne({ stripeEventId });
  }

  async findById(id: string | ObjectId): Promise<StripeWebhook | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return await this.db.collection<StripeWebhook>('stripe_webhooks').findOne({ _id: objectId });
  }

  async markAsProcessed(eventId: string, error?: string): Promise<void> {
    await this.db.collection<StripeWebhook>('stripe_webhooks').updateOne(
      { stripeEventId: eventId },
      { 
        $set: { 
          processed: true, 
          processedAt: new Date(),
          ...(error && { error })
        } 
      }
    );
  }

  async findUnprocessed(limit?: number): Promise<StripeWebhook[]> {
    let cursor = this.db.collection<StripeWebhook>('stripe_webhooks')
      .find({ processed: false })
      .sort({ createdAt: 1 });

    if (limit) {
      cursor = cursor.limit(limit);
    }

    return await cursor.toArray();
  }

  async findAll(options?: { 
    processed?: boolean; 
    eventType?: string; 
    limit?: number; 
    skip?: number;
  }): Promise<StripeWebhook[]> {
    const query: any = {};

    if (options?.processed !== undefined) {
      query.processed = options.processed;
    }

    if (options?.eventType) {
      query.eventType = options.eventType;
    }

    let cursor = this.db.collection<StripeWebhook>('stripe_webhooks')
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
}
