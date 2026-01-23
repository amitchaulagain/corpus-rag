// Get user token balance
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

    // Get token service
    const tokenService = await TokenService.create();

    // Get token information
    const tokenInfo = await tokenService.getTokenInfo(auth.user.id);

    return json({
      success: true,
      data: {
        tokenBalance: tokenInfo.tokenBalance,
        totalPurchased: tokenInfo.totalPurchased,
        totalUsed: tokenInfo.totalUsed,
        lastPurchaseAt: tokenInfo.lastPurchaseAt?.toISOString(),
        lastUsageAt: tokenInfo.lastUsageAt?.toISOString()
      }
    });
  } catch (error: any) {
    console.error('Error getting token balance:', error);
    return json(
      { success: false, error: error.message || 'Failed to get token balance' },
      { status: 500 }
    );
  }
};
