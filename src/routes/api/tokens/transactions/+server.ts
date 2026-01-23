// Get token transaction history
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateJwt } from '$lib/jwt-middleware';
import { TokenService } from '$lib/services/token-service';

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
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const type = url.searchParams.get('type') as 'purchase' | 'usage' | 'refund' | 'bonus' | 'adjustment' | undefined;
    const startDate = url.searchParams.get('startDate') ? new Date(url.searchParams.get('startDate')!) : undefined;
    const endDate = url.searchParams.get('endDate') ? new Date(url.searchParams.get('endDate')!) : undefined;

    // Get token service
    const tokenService = await TokenService.create();

    // Get transaction history
    const result = await tokenService.getTransactionHistory(auth.user.id, {
      type,
      limit,
      skip: (page - 1) * limit,
      startDate,
      endDate
    });

    return json({
      success: true,
      data: {
        transactions: result.transactions.map(tx => ({
          id: tx._id?.toString(),
          type: tx.type,
          amount: tx.amount,
          balanceBefore: tx.balanceBefore,
          balanceAfter: tx.balanceAfter,
          description: tx.description,
          tokensUsed: tx.tokensUsed,
          deepseekTokensUsed: tx.deepseekTokensUsed,
          endpoint: tx.endpoint,
          aiProvider: tx.aiProvider,
          createdAt: tx.createdAt.toISOString(),
          metadata: tx.metadata
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
    console.error('Error getting transaction history:', error);
    return json(
      { success: false, error: error.message || 'Failed to get transaction history' },
      { status: 500 }
    );
  }
};
