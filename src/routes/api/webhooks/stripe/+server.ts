// Stripe webhook handler
import { json, text } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { StripeService } from '$lib/services/stripe-service';
import Stripe from 'stripe';

export const POST: RequestHandler = async (event) => {
  try {
    // Get Stripe webhook secret from environment
    const webhookSecret = env?.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      return json(
        { success: false, error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    if (!StripeService.isConfigured()) {
      return json(
        { success: false, error: 'Stripe is not configured' },
        { status: 503 }
      );
    }

    // Get raw body and signature
    const body = await event.request.text();
    const signature = event.request.headers.get('stripe-signature');

    if (!signature) {
      return json(
        { success: false, error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let stripeEvent: Stripe.Event;
    try {
      stripeEvent = StripeService.verifyWebhookSignature(
        body,
        signature,
        webhookSecret
      );
    } catch (error: any) {
      console.error('Webhook signature verification failed:', error);
      return json(
        { success: false, error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Get Stripe service
    const stripeService = await StripeService.create();

    // Handle webhook event
    try {
      await stripeService.handleWebhookEvent(stripeEvent);
    } catch (error: any) {
      console.error(`Error handling webhook event ${stripeEvent.id}:`, error);
      // Return 200 to prevent Stripe from retrying, but log the error
      // Stripe will retry if we return non-2xx, but we've already stored the event
      return json(
        { 
          success: false, 
          error: error.message,
          eventId: stripeEvent.id 
        },
        { status: 200 } // Return 200 so Stripe doesn't retry
      );
    }

    // Return success
    return json({
      success: true,
      eventId: stripeEvent.id,
      eventType: stripeEvent.type
    });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return json(
      { success: false, error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
};

// Stripe requires GET for webhook endpoint verification
export const GET: RequestHandler = async () => {
  return text('Stripe webhook endpoint is active');
};
