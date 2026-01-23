// Check if user has enough tokens for an operation
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateJwt } from '$lib/jwt-middleware';
import { TokenService } from '$lib/services/token-service';

export const POST: RequestHandler = async (event) => {
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

    // Get request body
    const body = await event.request.json();
    const { requiredTokens } = body;

    if (!requiredTokens || typeof requiredTokens !== 'number' || requiredTokens <= 0) {
      return json(
        { success: false, error: 'requiredTokens must be a positive number' },
        { status: 400 }
      );
    }

    // Get token service
    const tokenService = await TokenService.create();

    // Check tokens
    const result = await tokenService.checkTokens(auth.user.id, requiredTokens);

    return json({
      success: true,
      data: {
        hasEnoughTokens: result.hasEnoughTokens,
        currentBalance: result.currentBalance,
        requiredTokens: result.requiredTokens,
        remainingAfter: result.remainingAfter
      }
    });
  } catch (error: any) {
    console.error('Error checking tokens:', error);
    return json(
      { success: false, error: error.message || 'Failed to check tokens' },
      { status: 500 }
    );
  }
};
