// Get order details
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateJwt } from '$lib/jwt-middleware';
import { OrderService } from '$lib/services/order-service';
import { ObjectId } from 'mongodb';

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

    // Get order ID from params
    const orderId = event.params.orderId;
    if (!orderId) {
      return json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Get order service
    const orderService = await OrderService.create();

    // Get order
    const result = await orderService.getOrderById(orderId, true);
    if (!result) {
      return json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Verify order belongs to user (unless admin)
    const orderUserId = result.order.userId.toString();
    if (orderUserId !== auth.user.id && auth.user.userType !== 'admin') {
      return json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    return json({
      success: true,
      data: {
        order: {
          id: result.order._id?.toString(),
          orderNumber: result.order.orderNumber,
          planId: result.order.planId,
          planName: result.plan?.name,
          planDescription: result.plan?.description,
          tokensPurchased: result.order.tokensPurchased,
          baseTokens: result.order.baseTokens,
          bonusTokens: result.order.bonusTokens,
          amount: result.order.amount,
          currency: result.order.currency,
          taxAmount: result.order.taxAmount,
          totalAmount: result.order.totalAmount,
          status: result.order.status,
          paymentStatus: result.order.paymentStatus,
          paymentMethod: result.order.paymentMethod,
          stripePaymentIntentId: result.order.stripePaymentIntentId,
          createdAt: result.order.createdAt.toISOString(),
          updatedAt: result.order.updatedAt.toISOString(),
          completedAt: result.order.completedAt?.toISOString(),
          refundedAt: result.order.refundedAt?.toISOString(),
          notes: result.order.notes
        }
      }
    });
  } catch (error: any) {
    console.error('Error getting order:', error);
    return json(
      { success: false, error: error.message || 'Failed to get order' },
      { status: 500 }
    );
  }
};
