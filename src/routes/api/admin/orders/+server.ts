// Admin: Manage orders
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/db/mongodb';
import { UserModel } from '$lib/models/user';
import { SessionModel } from '$lib/models/session';
import { OrderService } from '$lib/services/order-service';
import { ObjectId } from 'mongodb';

// Helper to verify admin auth (session-based, like other admin endpoints)
async function requireAdmin(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing authorization');
  }

  const db = await getDB();
  const sessionModel = new SessionModel(db);
  const userModel = new UserModel(db);

  const token = authHeader.substring(7);
  const session = await sessionModel.findByToken(token);
  if (!session) {
    throw new Error('Invalid or expired session');
  }

  const user = await userModel.findById(session.userId);
  if (!user || user.userType !== 'admin') {
    throw new Error('Admin access required');
  }

  return { user, session };
}

// GET - List all orders
export const GET: RequestHandler = async (event) => {
  try {
    // Authenticate admin
    await requireAdmin(event.request);

    // Get query parameters
    const url = new URL(event.request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const userId = url.searchParams.get('userId');
    const status = url.searchParams.get('status') as any;
    const startDate = url.searchParams.get('startDate') ? new Date(url.searchParams.get('startDate')!) : undefined;
    const endDate = url.searchParams.get('endDate') ? new Date(url.searchParams.get('endDate')!) : undefined;

    // Get order service
    const orderService = await OrderService.create();

    // Get all orders
    let result;
    try {
      result = await orderService.getAllOrders({
        userId: userId ? new ObjectId(userId) : undefined,
        status,
        limit,
        skip: (page - 1) * limit,
        startDate,
        endDate
      });
      
      // Ensure result has expected structure
      if (!result) {
        result = { orders: [], total: 0 };
      }
      if (!result.orders) {
        result.orders = [];
      }
      if (typeof result.total !== 'number') {
        result.total = 0;
      }
    } catch (ordersError: any) {
      console.error('Error getting orders:', ordersError);
      console.error('Orders error stack:', ordersError.stack);
      // Return empty result instead of throwing
      result = { orders: [], total: 0 };
    }

    // Get statistics
    let stats = null;
    try {
      stats = await orderService.getOrderStats({ startDate, endDate });
    } catch (statsError: any) {
      console.error('Error getting order stats:', statsError);
      // Continue without stats if there's an error
      stats = {
        totalRevenue: 0,
        totalOrders: 0,
        pendingOrders: 0,
        completedOrders: 0,
        failedOrders: 0,
        refundedOrders: 0
      };
    }

    // Safely map orders
    const mappedOrders = (result.orders || []).map((order: any) => {
      try {
        return {
          id: order._id?.toString() || '',
          orderNumber: order.orderNumber || '',
          userId: order.userId?.toString() || '',
          planId: order.planId || '',
          planName: order.plan?.name || order.planId || '',
          tokensPurchased: order.tokensPurchased || 0,
          amount: order.amount || 0,
          currency: order.currency || 'USD',
          totalAmount: order.totalAmount || order.amount || 0,
          status: order.status || 'pending',
          paymentStatus: order.paymentStatus || 'pending',
          paymentMethod: order.paymentMethod || 'stripe',
          stripePaymentIntentId: order.stripePaymentIntentId || '',
          createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : new Date().toISOString(),
          completedAt: order.completedAt ? new Date(order.completedAt).toISOString() : null,
          notes: order.notes || ''
        };
      } catch (mapError: any) {
        console.error('Error mapping order:', mapError, order);
        return {
          id: order._id?.toString() || 'unknown',
          orderNumber: 'ERROR',
          userId: '',
          planId: '',
          planName: '',
          tokensPurchased: 0,
          amount: 0,
          currency: 'USD',
          totalAmount: 0,
          status: 'error',
          paymentStatus: 'pending',
          paymentMethod: 'stripe',
          stripePaymentIntentId: '',
          createdAt: new Date().toISOString(),
          completedAt: null,
          notes: 'Error loading order data'
        };
      }
    });

    return json({
      success: true,
      data: {
        orders: mappedOrders,
        pagination: {
          page,
          limit,
          total: result.total || 0,
          totalPages: Math.ceil((result.total || 0) / limit)
        },
        stats: stats || {
          totalRevenue: 0,
          totalOrders: 0,
          pendingOrders: 0,
          completedOrders: 0,
          failedOrders: 0,
          refundedOrders: 0
        }
      }
    });
  } catch (error: any) {
    console.error('Error in admin orders endpoint:', error);
    console.error('Error stack:', error.stack);
    return json(
      {
        success: false,
        error: error.message || 'Failed to get orders'
      },
      { status: error.message?.includes('Admin') ? 403 : 500 }
    );
  }
};
