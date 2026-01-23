// Order Service - Handles order-related operations
import { connectToDatabase, ObjectId } from '../db/mongodb';
import { OrderModel } from '../models/order';
import { TokenPlanModel } from '../models/token-plan';
import { TokenService } from './token-service';
import { UserModel } from '../models/user';
import type { Db } from 'mongodb';
import type { OrderStatus, PaymentStatus } from '../models/order';

export interface OrderSummary {
  order: any;
  plan?: any;
}

export interface OrderStats {
  totalRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  failedOrders: number;
  refundedOrders: number;
}

export class OrderService {
  private db: Db;
  private orderModel: OrderModel;
  private planModel: TokenPlanModel;
  private tokenService: TokenService;
  private userModel: UserModel;

  constructor(db?: Db) {
    this.db = db as Db;
    this.orderModel = new OrderModel(this.db);
    this.planModel = new TokenPlanModel(this.db);
    this.tokenService = new TokenService(this.db);
    this.userModel = new UserModel(this.db);
  }

  static async create(): Promise<OrderService> {
    const db = await connectToDatabase();
    return new OrderService(db);
  }

  /**
   * Get order by ID with plan details
   */
  async getOrderById(orderId: string | ObjectId, includePlan: boolean = true): Promise<OrderSummary | null> {
    const order = await this.orderModel.findById(orderId);
    if (!order) {
      return null;
    }

    let plan = undefined;
    if (includePlan && order.planId) {
      try {
        plan = await this.planModel.findByPlanId(order.planId as any);
      } catch (error: any) {
        console.error(`Error loading plan ${order.planId} for order ${orderId}:`, error);
        // Continue without plan if lookup fails
      }
    }

    return {
      order,
      plan
    };
  }

  /**
   * Get order by order number
   */
  async getOrderByNumber(orderNumber: string, includePlan: boolean = true): Promise<OrderSummary | null> {
    const order = await this.orderModel.findByOrderNumber(orderNumber);
    if (!order) {
      return null;
    }

    let plan = undefined;
    if (includePlan && order.planId) {
      try {
        plan = await this.planModel.findByPlanId(order.planId as any);
      } catch (error: any) {
        console.error(`Error loading plan ${order.planId} for order ${orderNumber}:`, error);
        // Continue without plan if lookup fails
      }
    }

    return {
      order,
      plan
    };
  }

  /**
   * Get user's orders
   */
  async getUserOrders(
    userId: string | ObjectId,
    options?: {
      status?: OrderStatus;
      limit?: number;
      skip?: number;
    }
  ): Promise<{
    orders: any[];
    total: number;
  }> {
    const orders = await this.orderModel.findByUserId(userId, options);
    const total = await this.orderModel.count({ userId: typeof userId === 'string' ? new ObjectId(userId) : userId });

    // Enrich with plan details
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        try {
          let plan = null;
          if (order.planId) {
            try {
              plan = await this.planModel.findByPlanId(order.planId as any);
            } catch (planError: any) {
              console.error(`Error loading plan ${order.planId} for order ${order._id}:`, planError);
              // Continue without plan if lookup fails
            }
          }
          return {
            ...order,
            plan
          };
        } catch (error: any) {
          console.error(`Error processing order ${order._id}:`, error);
          return {
            ...order,
            plan: null
          };
        }
      })
    );

    return {
      orders: enrichedOrders,
      total
    };
  }

  /**
   * Get all orders (admin)
   */
  async getAllOrders(options?: {
    userId?: string | ObjectId;
    status?: OrderStatus;
    limit?: number;
    skip?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    orders: any[];
    total: number;
  }> {
    const orders = await this.orderModel.findAll(options);
    
    // Build count query matching findAll query
    const countQuery: any = {};
    if (options?.userId) {
      const objectId = typeof options.userId === 'string' ? new ObjectId(options.userId) : options.userId;
      countQuery.userId = objectId;
    }
    if (options?.status) {
      countQuery.status = options.status;
    }
    if (options?.startDate || options?.endDate) {
      countQuery.createdAt = {};
      if (options.startDate) {
        countQuery.createdAt.$gte = options.startDate;
      }
      if (options.endDate) {
        countQuery.createdAt.$lte = options.endDate;
      }
    }
    
    const total = await this.orderModel.count(countQuery);

    // Enrich with plan details
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        try {
          let plan = null;
          if (order.planId) {
            try {
              plan = await this.planModel.findByPlanId(order.planId as any);
            } catch (planError: any) {
              console.error(`Error loading plan ${order.planId} for order ${order._id}:`, planError);
              // Continue without plan if lookup fails
            }
          }
          return {
            ...order,
            plan
          };
        } catch (error: any) {
          console.error(`Error processing order ${order._id}:`, error);
          return {
            ...order,
            plan: null
          };
        }
      })
    );

    return {
      orders: enrichedOrders,
      total
    };
  }

  /**
   * Get order statistics
   */
  async getOrderStats(options?: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<OrderStats> {
    const query: any = {};

    if (options?.startDate || options?.endDate) {
      query.createdAt = {};
      if (options.startDate) {
        query.createdAt.$gte = options.startDate;
      }
      if (options.endDate) {
        query.createdAt.$lte = options.endDate;
      }
    }

    const allOrders = await this.orderModel.findAll(query);

    const stats: OrderStats = {
      totalRevenue: 0,
      totalOrders: allOrders.length,
      pendingOrders: 0,
      completedOrders: 0,
      failedOrders: 0,
      refundedOrders: 0
    };

    for (const order of allOrders) {
      if (order.status === 'completed' && order.paymentStatus === 'succeeded') {
        stats.totalRevenue += order.totalAmount || order.amount || 0;
        stats.completedOrders++;
      } else if (order.status === 'pending' || order.status === 'processing') {
        stats.pendingOrders++;
      } else if (order.status === 'failed') {
        stats.failedOrders++;
      } else if (order.status === 'refunded') {
        stats.refundedOrders++;
      }
    }

    return stats;
  }

  /**
   * Update order status (admin)
   * Automatically credits tokens when order is marked as completed
   */
  async updateOrderStatus(
    orderId: string | ObjectId,
    status: OrderStatus,
    paymentStatus?: PaymentStatus,
    notes?: string
  ): Promise<void> {
    // Get the current order to check if it's being completed
    const order = await this.orderModel.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const wasCompleted = order.status === 'completed';
    const isBeingCompleted = status === 'completed' && !wasCompleted;

    const updates: any = {};
    if (notes) {
      updates.notes = notes;
    }

    // Update order status
    await this.orderModel.updateStatus(orderId, status, paymentStatus);
    
    if (Object.keys(updates).length > 0) {
      await this.orderModel.update(orderId, updates);
    }

    // If order is being marked as completed, credit tokens to user
    if (isBeingCompleted && paymentStatus === 'succeeded') {
      try {
        console.log(`🔄 Admin completing order ${order.orderNumber} - crediting tokens...`);
        
        // Credit base tokens
        await this.tokenService.addTokens(
          order.userId,
          order.baseTokens,
          'purchase',
          {
            orderId: order._id,
            description: `Purchased ${order.baseTokens} tokens from ${order.planId} plan (Admin completed)`
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
              description: `Bonus tokens from ${order.planId} plan (Admin completed)`
            }
          );
        }

        // Update user's current plan
        await this.userModel.setCurrentPlan(order.userId, order.planId as any);

        console.log(`✅ Tokens credited successfully for order ${order.orderNumber}`);
      } catch (error: any) {
        console.error(`❌ Error crediting tokens for order ${order.orderNumber}:`, error);
        // Don't throw - order status is already updated, just log the error
        // Admin can manually adjust tokens if needed
      }
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string | ObjectId, reason?: string): Promise<void> {
    const order = await this.orderModel.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status === 'completed') {
      throw new Error('Cannot cancel a completed order');
    }

    await this.orderModel.updateStatus(orderId, 'cancelled', 'failed');
    
    if (reason) {
      await this.orderModel.update(orderId, { notes: reason });
    }
  }
}
