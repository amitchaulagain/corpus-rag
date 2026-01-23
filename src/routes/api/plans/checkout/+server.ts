// Create Stripe checkout session
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateJwt } from '$lib/jwt-middleware';
import { StripeService } from '$lib/services/stripe-service';

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

    // Check if Stripe is configured
    if (!StripeService.isConfigured()) {
      return json(
        { success: false, error: 'Payment processing is not configured' },
        { status: 503 }
      );
    }

    // Get request body
    const body = await event.request.json();
    const { planId, successUrl, cancelUrl } = body;

    if (!planId || !successUrl || !cancelUrl) {
      return json(
        { success: false, error: 'planId, successUrl, and cancelUrl are required' },
        { status: 400 }
      );
    }

    // Get Stripe service
    const stripeService = await StripeService.create();

    // Create checkout session
    const result = await stripeService.createCheckoutSession(
      auth.user.id,
      planId,
      successUrl,
      cancelUrl
    );

    return json({
      success: true,
      data: {
        checkoutSessionId: result.sessionId,
        url: result.url,
        orderId: result.orderId
      }
    });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return json(
      { success: false, error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
};
