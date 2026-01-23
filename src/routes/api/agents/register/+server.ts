// Agent Registration API
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuthRBAC, requireRole } from '$lib/rbac-middleware.js';
import { getDB } from '$lib/db/mongodb.js';
import { AgentModel } from '$lib/models/agent.js';
import { UserModel } from '$lib/models/user.js';
import { ObjectId } from 'mongodb';

// Register as agent
export const POST: RequestHandler = async (event) => {
  try {
    // Require authentication
    const auth = await requireAuthRBAC(event);
    
    const { 
      agencyName, 
      licenseNumber, 
      contactEmail, 
      contactPhone,
      commissionRate,
      fixedFee,
      billingMethod 
    } = await event.request.json();
    
    if (!agencyName) {
      return json({ success: false, error: 'Agency name is required' }, { status: 400 });
    }
    
    const db = await getDB();
    const agentModel = new AgentModel(db);
    const userModel = new UserModel(db);
    
    // Check if user is already an agent
    const existingAgent = await agentModel.findByUserId(auth.user._id!);
    if (existingAgent) {
      return json({ 
        success: false, 
        error: 'User is already registered as an agent',
        agentId: existingAgent._id
      }, { status: 409 });
    }
    
    // Validate billing method
    const validBillingMethods = ['percentage', 'fixed', 'hybrid'];
    const billing = billingMethod || 'percentage';
    if (!validBillingMethods.includes(billing)) {
      return json({ 
        success: false, 
        error: `Billing method must be one of: ${validBillingMethods.join(', ')}` 
      }, { status: 400 });
    }
    
    // Validate commission rate (if percentage or hybrid)
    if ((billing === 'percentage' || billing === 'hybrid') && !commissionRate) {
      return json({ 
        success: false, 
        error: 'Commission rate is required for percentage or hybrid billing' 
      }, { status: 400 });
    }
    
    // Validate fixed fee (if fixed or hybrid)
    if ((billing === 'fixed' || billing === 'hybrid') && !fixedFee) {
      return json({ 
        success: false, 
        error: 'Fixed fee is required for fixed or hybrid billing' 
      }, { status: 400 });
    }
    
    // Create agent profile
    const agent = await agentModel.create({
      userId: auth.user._id!,
      agencyName,
      licenseNumber,
      contactEmail: contactEmail || auth.user.email,
      contactPhone,
      isActive: true,
      commissionRate: commissionRate || 0,
      fixedFee: fixedFee || 0,
      billingMethod: billing as 'percentage' | 'fixed' | 'hybrid'
    });
    
    // Assign agent role to user
    await userModel.assignRole(auth.user._id!, {
      role: 'agent',
      departmentId: null, // Agent role is system-wide
      grantedBy: auth.user._id!,
      grantedAt: new Date(),
      isActive: true
    });
    
    // Link agent profile to user
    await userModel.setAgentProfile(auth.user._id!, agent._id!, true);
    
    return json({
      success: true,
      message: 'Agent registration successful',
      agent: {
        id: agent._id,
        agencyName: agent.agencyName,
        commissionRate: agent.commissionRate,
        billingMethod: agent.billingMethod,
        isActive: agent.isActive
      }
    }, { status: 201 });
  } catch (error: any) {
    if (error.status) {
      return json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Agent registration error:', error);
    return json({ success: false, error: 'Failed to register as agent' }, { status: 500 });
  }
};

// Get own agent profile
export const GET: RequestHandler = async (event) => {
  try {
    const auth = await requireAuthRBAC(event);
    
    const db = await getDB();
    const agentModel = new AgentModel(db);
    
    const agent = await agentModel.findByUserId(auth.user._id!);
    if (!agent) {
      return json({ success: false, error: 'Agent profile not found' }, { status: 404 });
    }
    
    return json({
      success: true,
      agent: {
        id: agent._id,
        agencyName: agent.agencyName,
        licenseNumber: agent.licenseNumber,
        contactEmail: agent.contactEmail,
        contactPhone: agent.contactPhone,
        isActive: agent.isActive,
        commissionRate: agent.commissionRate,
        fixedFee: agent.fixedFee,
        billingMethod: agent.billingMethod,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt
      }
    });
  } catch (error: any) {
    if (error.status) {
      return json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Get agent profile error:', error);
    return json({ success: false, error: 'Failed to get agent profile' }, { status: 500 });
  }
};
