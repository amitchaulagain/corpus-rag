// Get available token plans
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { TokenPlanModel } from '$lib/models/token-plan';
import { connectToDatabase } from '$lib/db/mongodb';

export const GET: RequestHandler = async () => {
  try {
    const db = await connectToDatabase();
    const planModel = new TokenPlanModel(db);

    // Get all active plans
    const plans = await planModel.findAllActive();

    return json({
      success: true,
      data: {
        plans: plans.map(plan => ({
          planId: plan.planId,
          name: plan.name,
          description: plan.description,
          price: plan.price,
          currency: plan.currency,
          tokensIncluded: plan.tokensIncluded,
          bonusTokens: plan.bonusTokens || 0,
          features: plan.features,
          isPopular: plan.isPopular || false,
          badge: plan.badge,
          displayOrder: plan.displayOrder
        }))
      }
    });
  } catch (error: any) {
    console.error('Error getting plans:', error);
    return json(
      { success: false, error: error.message || 'Failed to get plans' },
      { status: 500 }
    );
  }
};
