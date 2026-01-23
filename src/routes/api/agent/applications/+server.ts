// Agent Application Submission - Agents apply for jobs on behalf of job seekers
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAgent } from '$lib/rbac-middleware.js';
import { getDB } from '$lib/db/mongodb.js';
import { AgentModel } from '$lib/models/agent.js';
import { JobModel } from '$lib/models/job.js';
import { UserModel } from '$lib/models/user.js';
import { TokenService } from '$lib/services/token-service.js';
import { getAuditService } from '$lib/services/audit-service.js';
import { ObjectId } from 'mongodb';

export const POST: RequestHandler = async (event) => {
  try {
    // Require agent role
    const auth = await requireAgent(event);
    
    if (!auth.agentId) {
      return json({ success: false, error: 'Agent profile not found' }, { status: 404 });
    }

    const { jobId, jobSeekerId, applicationData } = await event.request.json();
    
    if (!jobId || !jobSeekerId || !applicationData) {
      return json({ 
        success: false, 
        error: 'jobId, jobSeekerId, and applicationData are required' 
      }, { status: 400 });
    }

    const db = await getDB();
    const agentModel = new AgentModel(db);
    const jobModel = new JobModel(db);
    const userModel = new UserModel(db);

    // Verify agent exists and is active
    const agent = await agentModel.findById(auth.agentId);
    if (!agent || !agent.isActive) {
      return json({ success: false, error: 'Agent not found or inactive' }, { status: 404 });
    }

    // Verify job seeker exists
    const jobSeeker = await userModel.findById(jobSeekerId);
    if (!jobSeeker) {
      return json({ success: false, error: 'Job seeker not found' }, { status: 404 });
    }

    // Check agent-job seeker relationship
    const relationship = await agentModel.findRelationship(auth.agentId, jobSeekerId);
    if (!relationship || relationship.status !== 'active') {
      return json({ 
        success: false, 
        error: 'No active relationship with this job seeker' 
      }, { status: 403 });
    }

    // Verify job exists
    const job = await jobModel.findById(jobId);
    if (!job) {
      return json({ success: false, error: 'Job not found' }, { status: 404 });
    }

    // Calculate base cost for application (cover letter + resume + Q&A)
    const baseCost = 5; // Full application cost (2 + 2 + 1 tokens)
    
    // Calculate agent charges
    const chargeAmount = agentModel.calculateCharge(agent, relationship, baseCost);
    const totalCost = baseCost + chargeAmount; // Base cost + agent commission

    // Check job seeker's token balance
    const tokenService = await TokenService.create();
    const balance = await tokenService.getBalance(jobSeekerId);
    
    if (balance < totalCost) {
      return json({ 
        success: false, 
        error: 'Insufficient tokens',
        required: totalCost,
        available: balance,
        shortfall: totalCost - balance
      }, { status: 402 }); // 402 Payment Required
    }

    // Create agent application first (before charging)
    const agentApplication = await agentModel.createApplication({
      jobId: new ObjectId(jobId),
      jobSeekerId: new ObjectId(jobSeekerId),
      agentId: new ObjectId(auth.agentId),
      applicationData: {
        coverLetter: applicationData.coverLetter || '',
        resume: applicationData.resume || '',
        answers: applicationData.answers || []
      },
      charges: {
        amount: chargeAmount,
        commissionRate: relationship.contractTerms?.commissionRate ?? agent.commissionRate,
        fixedFee: relationship.contractTerms?.fixedFee ?? agent.fixedFee,
        currency: 'USD',
        status: 'pending'
      },
      status: 'pending',
      submittedAt: new Date()
    });

    // Charge job seeker (deduct tokens)
    const deductionResult = await tokenService.deductTokens(jobSeekerId, totalCost, {
      jobId: jobId,
      endpoint: 'agent_application',
      description: `Agent application fee: ${baseCost} tokens (base) + ${chargeAmount} tokens (agent commission)`,
      metadata: {
        agentId: auth.agentId,
        agentApplicationId: agentApplication._id?.toString(),
        baseCost,
        agentCommission: chargeAmount
      }
    });

    if (!deductionResult.success) {
      // Rollback: delete the agent application
      await agentModel.updateApplication(agentApplication._id!, { status: 'rejected' });
      return json({ 
        success: false, 
        error: 'Failed to charge job seeker',
        reason: 'Insufficient tokens or deduction failed'
      }, { status: 402 });
    }

    // Update charge status to 'charged'
    await agentModel.updateApplication(agentApplication._id!, {
      'charges.status': 'charged',
      'charges.chargedAt': new Date(),
      'charges.transactionId': deductionResult.transactionId?.toString()
    });
    
    // Log agent application and charge
    const auditService = await getAuditService();
    await auditService.logAgentApplication(
      auth.agentId!,
      agentApplication._id!,
      jobSeekerId,
      chargeAmount,
      event.getClientAddress(),
      event.request.headers.get('user-agent') || undefined
    );
    
    await auditService.logCharge(
      jobSeekerId,
      totalCost,
      deductionResult.transactionId!,
      {
        agentId: auth.agentId,
        applicationId: agentApplication._id?.toString(),
        baseCost,
        agentCommission: chargeAmount
      },
      event.getClientAddress(),
      event.request.headers.get('user-agent') || undefined
    );
    
    // Optionally create the actual job application
    await jobModel.createApplication(jobId, {
      status: 'pending',
      appliedAt: new Date(),
      coverLetter: applicationData.coverLetter || '',
      tailoredResume: applicationData.resume || '',
      questionAnswers: applicationData.answers || [],
      apiCalls: [],
      automationLogs: []
    });

    return json({
      success: true,
      message: 'Application submitted on behalf of job seeker',
      applicationId: agentApplication._id,
      charges: {
        amount: chargeAmount,
        baseCost: baseCost,
        totalCost: totalCost,
        status: 'charged',
        transactionId: deductionResult.transactionId?.toString()
      },
      agent: {
        id: agent._id,
        agencyName: agent.agencyName
      },
      jobSeeker: {
        id: jobSeeker._id,
        email: jobSeeker.email
      }
    });

  } catch (error: any) {
    if (error.status) {
      return json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Agent application error:', error);
    return json({ success: false, error: 'Application failed' }, { status: 500 });
  }
};

// Get agent's applications
export const GET: RequestHandler = async (event) => {
  try {
    const auth = await requireAgent(event);
    
    if (!auth.agentId) {
      return json({ success: false, error: 'Agent profile not found' }, { status: 404 });
    }

    const db = await getDB();
    const agentModel = new AgentModel(db);

    const applications = await agentModel.findApplicationsByAgent(auth.agentId, 100);

    return json({
      success: true,
      applications: applications.map(app => ({
        id: app._id,
        jobId: app.jobId,
        jobSeekerId: app.jobSeekerId,
        status: app.status,
        charges: app.charges,
        submittedAt: app.submittedAt
      }))
    });

  } catch (error: any) {
    if (error.status) {
      return json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Get agent applications error:', error);
    return json({ success: false, error: 'Failed to fetch applications' }, { status: 500 });
  }
};
