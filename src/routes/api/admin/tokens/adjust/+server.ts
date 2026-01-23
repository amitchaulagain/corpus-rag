// Admin: Manually adjust user tokens
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/auth-middleware';
import { TokenService } from '$lib/services/token-service';
import { ObjectId } from 'mongodb';

export const POST: RequestHandler = async (event) => {
  try {
    await requireAdmin(event);

    // Get request body
    const body = await event.request.json();
    const { userId, amount, reason, notes } = body;

    if (!userId || amount === undefined) {
      return json(
        { success: false, error: 'userId and amount are required' },
        { status: 400 }
      );
    }

    if (typeof amount !== 'number') {
      return json(
        { success: false, error: 'amount must be a number' },
        { status: 400 }
      );
    }

    // Get token service
    const tokenService = await TokenService.create();

    // Determine transaction type
    const type = amount > 0 ? 'adjustment' : 'adjustment';
    const description = reason || `Admin adjustment: ${amount > 0 ? '+' : ''}${amount} tokens`;

    // Add or deduct tokens
    let result;
    if (amount > 0) {
      result = await tokenService.addTokens(userId, amount, type, {
        description,
        metadata: { adminNotes: notes, reason }
      });
    } else {
      const deductResult = await tokenService.deductTokens(userId, Math.abs(amount), {
        description,
        metadata: { adminNotes: notes, reason }
      });
      
      if (!deductResult.success) {
        return json(
          { success: false, error: 'Insufficient tokens to deduct' },
          { status: 400 }
        );
      }
      
      result = {
        newBalance: deductResult.newBalance,
        transactionId: deductResult.transactionId
      };
    }

    return json({
      success: true,
      data: {
        userId,
        amount,
        newBalance: result.newBalance,
        transactionId: result.transactionId?.toString(),
        description
      }
    });
  } catch (error: any) {
    return json(
      {
        success: false,
        error: error.message || 'Failed to adjust tokens'
      },
      { status: error.message?.includes('Admin') ? 403 : 500 }
    );
  }
};
