// Agent Charges and Billing Management
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAgent, requireAuthRBAC } from '$lib/rbac-middleware.js';
import { getDB } from '$lib/db/mongodb.js';
import { AgentModel } from '$lib/models/agent.js';
import { ObjectId } from 'mongodb';

// Get agent's charges/commissions
export const GET: RequestHandler = async (event) => {
  try {
    const auth = await requireAgent(event);
    
    if (!auth.agentId) {
      return json({ success: false, error: 'Agent profile not found' }, { status: 404 });
    }

    const db = await getDB();
    const agentModel = new AgentModel(db);

    // Get all applications with charges
    const applications = await agentModel.findApplicationsByAgent(auth.agentId, 1000);
    
    // Calculate totals
    const totalCharges = applications
      .filter(app => app.charges.status === 'charged')
      .reduce((sum, app) => sum + app.charges.amount, 0);
    
    const pendingCharges = applications
      .filter(app => app.charges.status === 'pending')
      .reduce((sum, app) => sum + app.charges.amount, 0);
    
    const refundedCharges = applications
      .filter(app => app.charges.status === 'refunded')
      .reduce((sum, app) => sum + app.charges.amount, 0);

    // Group by status
    const byStatus = {
      charged: applications.filter(app => app.charges.status === 'charged'),
      pending: applications.filter(app => app.charges.status === 'pending'),
      refunded: applications.filter(app => app.charges.status === 'refunded')
    };

    return json({
      success: true,
      summary: {
        totalCharges,
        pendingCharges,
        refundedCharges,
        totalApplications: applications.length,
        chargedApplications: byStatus.charged.length,
        pendingApplications: byStatus.pending.length,
        refundedApplications: byStatus.refunded.length
      },
      charges: applications.map(app => ({
        applicationId: app._id,
        jobId: app.jobId,
        jobSeekerId: app.jobSeekerId,
        amount: app.charges.amount,
        baseCost: app.charges.baseCost,
        commissionRate: app.charges.commissionRate,
        fixedFee: app.charges.fixedFee,
        currency: app.charges.currency,
        status: app.charges.status,
        chargedAt: app.charges.chargedAt,
        transactionId: app.charges.transactionId,
        submittedAt: app.submittedAt
      }))
    });
  } catch (error: any) {
    if (error.status) {
      return json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Get agent charges error:', error);
    return json({ success: false, error: 'Failed to get charges' }, { status: 500 });
  }
};
