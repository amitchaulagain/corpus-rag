// Stripe Service - Handles payment processing and webhook events
import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { connectToDatabase, ObjectId } from '../db/mongodb';
import { OrderModel } from '../models/order';
import { TokenPlanModel } from '../models/token-plan';
import { StripeWebhookModel } from '../models/stripe-webhook';
import { UserModel } from '../models/user';
import { TokenService } from './token-service';
import type { Db } from 'mongodb';

// Lazy initialization of Stripe
let stripe: Stripe | null = null;
let stripeInitialized = false;

/**
 * Get or initialize Stripe instance
 * Uses SvelteKit's $env/dynamic/private for environment variables
 */
function getStripe(): Stripe | null {
  if (stripeInitialized) {
    return stripe;
  }

  stripeInitialized = true;
  
  // Try to get the key from environment
  // SvelteKit's env system first, then process.env as fallback
  const stripeSecretKey = (env && typeof env === 'object' && 'STRIPE_SECRET_KEY' in env)
    ? env.STRIPE_SECRET_KEY
    : process.env.STRIPE_SECRET_KEY;
  
  if (!stripeSecretKey) {
    console.warn('⚠️  STRIPE_SECRET_KEY not found in environment variables');
    console.warn('   Make sure STRIPE_SECRET_KEY is set in your .env file');
    console.warn('   Current env keys:', env ? Object.keys(env).join(', ') : 'env is null/undefined');
    return null;
  }

  try {
    console.log('✅ Stripe secret key found, initializing Stripe...');
    stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia',
    });
    console.log('✅ Stripe initialized successfully');
    return stripe;
  } catch (error) {
    console.error('❌ Failed to initialize Stripe:', error);
    stripe = null;
    return null;
  }
}

export class StripeService {
  private db: Db;
  private orderModel: OrderModel;
  private planModel: TokenPlanModel;
  private webhookModel: StripeWebhookModel;
  private userModel: UserModel;
  private tokenService: TokenService;

  constructor(db?: Db) {
    this.db = db as Db;
    this.orderModel = new OrderModel(this.db);
    this.planModel = new TokenPlanModel(this.db);
    this.webhookModel = new StripeWebhookModel(this.db);
    this.userModel = new UserModel(this.db);
    this.tokenService = new TokenService(this.db);
  }

  static async create(): Promise<StripeService> {
    const db = await connectToDatabase();
    return new StripeService(db);
  }

  /**
   * Check if Stripe is configured
   */
  static isConfigured(): boolean {
    return getStripe() !== null;
  }

  /**
   * Get Stripe instance
   */
  static getStripe(): Stripe | null {
    return getStripe();
  }

  /**
   * Create or retrieve Stripe customer for a user
   */
  async getOrCreateCustomer(userId: string | ObjectId, email: string, name?: string): Promise<string> {
    const stripeInstance = getStripe();
    if (!stripeInstance) {
      throw new Error('Stripe is not configured');
    }

    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const user = await this.userModel.findById(objectId);

    // If user already has a Stripe customer ID, return it
    if (user?.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    // Create new Stripe customer
    const customer = await stripeInstance.customers.create({
      email,
      name,
      metadata: {
        userId: objectId.toString()
      }
    });

    // Save customer ID to user
    await this.userModel.setStripeCustomerId(objectId, customer.id);

    return customer.id;
  }

  /**
   * Create a checkout session for a plan purchase
   */
  async createCheckoutSession(
    userId: string | ObjectId,
    planId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ sessionId: string; url: string; orderId: string }> {
    const stripeInstance = getStripe();
    if (!stripeInstance) {
      throw new Error('Stripe is not configured');
    }

    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const user = await this.userModel.findById(objectId);
    
    if (!user) {
      throw new Error('User not found');
    }

    // Get plan details
    const plan = await this.planModel.findByPlanId(planId as any);
    if (!plan || !plan.isActive) {
      throw new Error('Plan not found or inactive');
    }

    // Get or create Stripe customer
    const customerId = await this.getOrCreateCustomer(objectId, user.email, user.name);

    // Create order record
    const orderNumber = OrderModel.generateOrderNumber();
    const totalTokens = plan.tokensIncluded + (plan.bonusTokens || 0);
    
    const order = await this.orderModel.create({
      userId: objectId,
      orderNumber,
      status: 'pending',
      planId: plan.planId,
      tokensPurchased: totalTokens,
      baseTokens: plan.tokensIncluded,
      bonusTokens: plan.bonusTokens || 0,
      amount: plan.price,
      currency: plan.currency,
      totalAmount: plan.price,
      paymentMethod: 'card',
      paymentStatus: 'pending',
      metadata: {
        planName: plan.name,
        planDescription: plan.description
      }
    });

    // Create Stripe Checkout Session
    const session = await stripeInstance.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: plan.currency,
            product_data: {
              name: plan.name,
              description: plan.description,
            },
            unit_amount: plan.price,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: objectId.toString(),
        orderId: order._id!.toString(),
        orderNumber: orderNumber,
        planId: plan.planId,
        tokensPurchased: totalTokens.toString()
      },
    });

    // Update order with session ID
    await this.orderModel.update(order._id!, {
      stripeSessionId: session.id
    });

    return {
      sessionId: session.id,
      url: session.url || '',
      orderId: order._id!.toString()
    };
  }

  /**
   * Handle Stripe webhook event
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    const stripeInstance = getStripe();
    if (!stripeInstance) {
      throw new Error('Stripe is not configured');
    }

    // Check if we've already processed this event (idempotency)
    const existing = await this.webhookModel.findByEventId(event.id);
    if (existing?.processed) {
      console.log(`Event ${event.id} already processed, skipping`);
      return;
    }

    // Store webhook event
    if (!existing) {
      await this.webhookModel.create({
        stripeEventId: event.id,
        eventType: event.type,
        payload: event as any,
        processed: false
      });
    }

    try {
      // Handle different event types
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event);
          break;
        
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event);
          break;
        
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event);
          break;
        
        case 'charge.refunded':
          await this.handleRefund(event);
          break;
        
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      // Mark as processed
      await this.webhookModel.markAsProcessed(event.id);
    } catch (error: any) {
      console.error(`Error processing webhook event ${event.id}:`, error);
      await this.webhookModel.markAsProcessed(event.id, error.message);
      throw error;
    }
  }

  /**
   * Handle checkout.session.completed event
   */
  private async handleCheckoutCompleted(event: Stripe.Event): Promise<void> {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderNumber = session.metadata?.orderNumber;

    if (!orderNumber) {
      throw new Error('Order number not found in session metadata');
    }

    const order = await this.orderModel.findByOrderNumber(orderNumber);
    if (!order) {
      throw new Error(`Order not found: ${orderNumber}`);
    }

    if (order.status === 'completed') {
      console.log(`Order ${orderNumber} already completed`);
      return;
    }

    // Update order status
    await this.orderModel.updateStatus(order._id!, 'completed', 'succeeded');
    
    const updateData: any = {
      stripeCustomerId: session.customer as string
    };
    
    if (session.payment_intent) {
      updateData.stripePaymentIntentId = session.payment_intent as string;
    }
    
    await this.orderModel.update(order._id!, updateData);

    // Credit tokens to user
    const totalTokens = order.tokensPurchased;
    await this.tokenService.addTokens(
      order.userId,
      order.baseTokens,
      'purchase',
      {
        orderId: order._id,
        description: `Purchased ${order.baseTokens} tokens from ${order.planId} plan`
      }
    );

    // Add bonus tokens if any
    if (order.bonusTokens > 0) {
      await this.tokenService.addTokens(
        order.userId,
        order.bonusTokens,
        'bonus',
        {
          orderId: order._id,
          description: `Bonus tokens from ${order.planId} plan`
        }
      );
    }

    // Update user's current plan
    await this.userModel.setCurrentPlan(order.userId, order.planId as any);
  }

  /**
   * Handle payment_intent.succeeded event
   */
  private async handlePaymentSucceeded(event: Stripe.Event): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    
    // Find order by payment intent ID
    const order = await this.orderModel.findByStripePaymentIntentId(paymentIntent.id);
    
    if (order && order.status !== 'completed') {
      await this.handleCheckoutCompleted(event);
    }
  }

  /**
   * Handle payment_intent.payment_failed event
   */
  private async handlePaymentFailed(event: Stripe.Event): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    
    // Find order by payment intent ID
    const order = await this.orderModel.findByStripePaymentIntentId(paymentIntent.id);
    
    if (order && order.status === 'pending') {
      await this.orderModel.updateStatus(order._id!, 'failed', 'failed');
    }
  }

  /**
   * Handle charge.refunded event
   */
  private async handleRefund(event: Stripe.Event): Promise<void> {
    const charge = event.data.object as Stripe.Charge;
    
    // Find order by charge ID
    const order = await this.orderModel.findByStripeChargeId(charge.id);
    
    if (order && order.status !== 'refunded') {
      await this.orderModel.updateStatus(order._id!, 'refunded', 'refunded');
      
      // Optionally deduct tokens (if business logic requires)
      // This depends on your refund policy
      // For now, we'll leave tokens with the user unless explicitly requested
    }
  }

  /**
   * Verify webhook signature
   */
  static verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): Stripe.Event {
    const stripeInstance = getStripe();
    if (!stripeInstance) {
      throw new Error('Stripe is not configured');
    }

    return stripeInstance.webhooks.constructEvent(payload, signature, secret);
  }
}
