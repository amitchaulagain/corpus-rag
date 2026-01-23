// Refund Agent Application Charge
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuthRBAC, requirePermission, requireRole } from '$lib/rbac-middleware.js';
import { getDB } from '$lib/db/mongodb.js';
import { AgentModel } from '$lib/models/agent.js';
import { UserModel } from '$lib/models/user.js';
import { TokenService } from '$lib/services/token-service.js';
import { getAuditService } from '$lib/services/audit-service.js';
import { ObjectId } from 'mongodb';

export const POST: RequestHandler = async (event) => {
  try {
    // Require admin role or billing:refund permission
    const auth = await requirePermission(event, 'billing', 'refund').catch(() => 
      requireRole(event, 'admin')
    );
    
    const applicationId = event.params.id;
    const { reason } = await event.request.json();
    
    if (!applicationId) {
      return json({ success: false, error: 'Application ID required' }, { status: 400 });
    }
    
    if (!reason) {
      return json({ success: false, error: 'Refund reason is required' }, { status: 400 });
    }
    
    const db = await getDB();
    const agentModel = new AgentModel(db);
    const userModel = new UserModel(db);
    const tokenService = await TokenService.create();
    const auditService = await getAuditService();
    
    // Get application
    const application = await agentModel.findApplicationById(applicationId);
    if (!application) {
      return json({ success: false, error: 'Application not found' }, { status: 404 });
    }
    
    // Check if already refunded
    if (application.charges.status === 'refunded') {
      return json({ success: false, error: 'Charge already refunded' }, { status: 409 });
    }
    
    // Check if charge was actually processed
    if (application.charges.status !== 'charged') {
      return json({ 
        success: false, 
        error: `Cannot refund charge with status: ${application.charges.status}` 
      }, { status: 400 });
    }
    
    // Get job seeker
    const jobSeeker = await userModel.findById(application.jobSeekerId);
    if (!jobSeeker) {
      return json({ success: false, error: 'Job seeker not found' }, { status: 404 });
    }
    
    // Calculate refund amount (base cost + agent commission)
    const baseCost = application.charges.baseCost || 5;
    const agentCommission = application.charges.amount || 0;
    const totalRefund = baseCost + agentCommission;
    
    // Refund tokens to job seeker and create transaction record
    await tokenService.addTokens(
      application.jobSeekerId, 
      totalRefund, 
      'refund',
      {
        description: `Refund for agent application: ${reason}`,
        metadata: {
          applicationId: application._id?.toString(),
          agentId: application.agentId.toString(),
          originalTransactionId: application.charges.transactionId,
          refundReason: reason,
          refundedBy: auth.user._id?.toString() || ''
        }
      }
    );
    
    // Update application charge status
    if (!auth.user._id) {
      return json({ success: false, error: 'User ID not found' }, { status: 500 });
    }
    
    await agentModel.updateApplication(applicationId, {
      'charges.status': 'refunded',
      'charges.refundedAt': new Date(),
      'charges.refundReason': reason,
      'charges.refundedBy': auth.user._id
    });
    
    // Log refund
    await auditService.logRefund(
      auth.user._id,
      totalRefund,
      application.charges.transactionId || application._id!,
      reason,
      event.getClientAddress(),
      event.request.headers.get('user-agent') || undefined
    );
    
    return json({
      success: true,
      message: 'Refund processed successfully',
      refund: {
        applicationId: application._id,
        amount: totalRefund,
        baseCost,
        agentCommission,
        reason,
        refundedAt: new Date()
      }
    });
  } catch (error: any) {
    if (error.status) {
      return json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Refund error:', error);
    return json({ success: false, error: 'Failed to process refund' }, { status: 500 });
  }
};
