// Job Seeker's Agent Charges View
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuthRBAC } from '$lib/rbac-middleware.js';
import { getDB } from '$lib/db/mongodb.js';
import { AgentModel } from '$lib/models/agent.js';
import { ObjectId } from 'mongodb';

// Get job seeker's charges from agents
export const GET: RequestHandler = async (event) => {
  try {
    const auth = await requireAuthRBAC(event);
    const jobSeekerId = event.url.searchParams.get('jobSeekerId') || auth.user._id!.toString();
    
    // Users can only view their own charges, unless they have admin permission
    if (jobSeekerId !== auth.user._id!.toString()) {
      // Check for admin permission
      const { requirePermission } = await import('$lib/rbac-middleware.js');
      await requirePermission(event, 'billing', 'read', 'all').catch(() => {
        throw { status: 403, message: 'Permission denied' };
      });
    }

    const db = await getDB();
    const agentModel = new AgentModel(db);

    // Get all applications where this user is the job seeker
    const applications = await agentModel.findApplicationsByJobSeeker(jobSeekerId, 1000);
    
    // Calculate totals
    const totalCharged = applications
      .filter(app => app.charges.status === 'charged')
      .reduce((sum, app) => sum + app.charges.amount, 0);
    
    const totalPending = applications
      .filter(app => app.charges.status === 'pending')
      .reduce((sum, app) => sum + app.charges.amount, 0);
    
    const totalRefunded = applications
      .filter(app => app.charges.status === 'refunded')
      .reduce((sum, app) => sum + app.charges.amount, 0);

    // Get agent details for each application
    const applicationsWithAgents = await Promise.all(
      applications.map(async (app) => {
        const agent = await agentModel.findById(app.agentId);
        return {
          applicationId: app._id,
          jobId: app.jobId,
          agent: {
            id: agent?._id,
            agencyName: agent?.agencyName
          },
          charges: {
            amount: app.charges.amount,
            baseCost: app.charges.baseCost,
            commissionRate: app.charges.commissionRate,
            fixedFee: app.charges.fixedFee,
            currency: app.charges.currency,
            status: app.charges.status,
            chargedAt: app.charges.chargedAt,
            transactionId: app.charges.transactionId
          },
          submittedAt: app.submittedAt,
          status: app.status
        };
      })
    );

    return json({
      success: true,
      jobSeekerId,
      summary: {
        totalCharged,
        totalPending,
        totalRefunded,
        totalApplications: applications.length
      },
      charges: applicationsWithAgents
    });
  } catch (error: any) {
    if (error.status) {
      return json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Get job seeker charges error:', error);
    return json({ success: false, error: 'Failed to get charges' }, { status: 500 });
  }
};
