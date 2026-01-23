// Test endpoint to check environment variables
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async () => {
  const stripeKey = env?.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
  const allEnvKeys = env ? Object.keys(env).filter(k => k.includes('STRIPE')) : [];
  
  return json({
    stripeKeyFound: !!stripeKey,
    stripeKeyLength: stripeKey ? stripeKey.length : 0,
    stripeKeyPreview: stripeKey ? `${stripeKey.substring(0, 10)}...` : 'NOT FOUND',
    allStripeEnvKeys: allEnvKeys,
    processEnvKeys: Object.keys(process.env).filter(k => k.includes('STRIPE')),
    envObjectExists: !!env,
    envKeysCount: env ? Object.keys(env).length : 0
  });
};
