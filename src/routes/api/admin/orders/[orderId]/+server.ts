// Admin: Update order status
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDB } from '$lib/db/mongodb';
import { UserModel } from '$lib/models/user';
import { SessionModel } from '$lib/models/session';
import { OrderService } from '$lib/services/order-service';

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

// PATCH - Update order status
export const PATCH: RequestHandler = async (event) => {
  try {
    await requireAdmin(event.request);

    // Get order ID from params
    const orderId = event.params.orderId;
    if (!orderId) {
      return json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Get request body
    const body = await event.request.json();
    const { status, paymentStatus, notes } = body;

    if (!status) {
      return json(
        { success: false, error: 'status is required' },
        { status: 400 }
      );
    }

    // Get order service
    const orderService = await OrderService.create();

    // Update order status
    await orderService.updateOrderStatus(orderId, status, paymentStatus, notes);

    // Get updated order
    const result = await orderService.getOrderById(orderId, true);

    return json({
      success: true,
      data: {
        order: {
          id: result?.order._id?.toString(),
          orderNumber: result?.order.orderNumber,
          status: result?.order.status,
          paymentStatus: result?.order.paymentStatus,
          notes: result?.order.notes
        }
      }
    });
  } catch (error: any) {
    return json(
      {
        success: false,
        error: error.message || 'Failed to update order'
      },
      { status: error.message?.includes('Admin') ? 403 : 500 }
    );
  }
};
