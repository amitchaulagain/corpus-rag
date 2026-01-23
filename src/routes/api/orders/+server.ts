// Get user orders
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateJwt } from '$lib/jwt-middleware';
import { OrderService } from '$lib/services/order-service';

export const GET: RequestHandler = async (event) => {
  try {
    // Authenticate user
    const auth = await authenticateJwt(event);
    if (auth instanceof Response) {
      return auth;
    }

    // Only allow user accounts (not service accounts)
    if (auth.user.type !== 'user') {
      return json(
        { success: false, error: 'User account required' },
        { status: 403 }
      );
    }

    // Get query parameters
    const url = new URL(event.request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const status = url.searchParams.get('status') as any;

    // Get order service
    const orderService = await OrderService.create();

    // Get user orders
    const result = await orderService.getUserOrders(auth.user.id, {
      status,
      limit,
      skip: (page - 1) * limit
    });

    return json({
      success: true,
      data: {
        orders: result.orders.map(order => ({
          id: order._id?.toString(),
          orderNumber: order.orderNumber,
          planId: order.planId,
          planName: order.plan?.name,
          tokensPurchased: order.tokensPurchased,
          amount: order.amount,
          currency: order.currency,
          status: order.status,
          paymentStatus: order.paymentStatus,
          createdAt: order.createdAt.toISOString(),
          completedAt: order.completedAt?.toISOString()
        })),
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit)
        }
      }
    });
  } catch (error: any) {
    console.error('Error getting orders:', error);
    return json(
      { success: false, error: error.message || 'Failed to get orders' },
      { status: 500 }
    );
  }
};
