// Agent-Job Seeker Relationship Management
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAgent, requireAuthRBAC } from '$lib/rbac-middleware.js';
import { getDB } from '$lib/db/mongodb.js';
import { AgentModel } from '$lib/models/agent.js';
import { UserModel } from '$lib/models/user.js';
import { ObjectId } from 'mongodb';

// Link job seeker to agent
export const POST: RequestHandler = async (event) => {
  try {
    // Require agent role
    const auth = await requireAgent(event);
    
    if (!auth.agentId) {
      return json({ success: false, error: 'Agent profile not found' }, { status: 404 });
    }
    
    const { jobSeekerId, contractTerms } = await event.request.json();
    
    if (!jobSeekerId) {
      return json({ success: false, error: 'Job seeker ID is required' }, { status: 400 });
    }
    
    const db = await getDB();
    const agentModel = new AgentModel(db);
    const userModel = new UserModel(db);
    
    // Verify agent exists
    const agent = await agentModel.findById(auth.agentId);
    if (!agent || !agent.isActive) {
      return json({ success: false, error: 'Agent not found or inactive' }, { status: 404 });
    }
    
    // Verify job seeker exists
    const jobSeeker = await userModel.findById(jobSeekerId);
    if (!jobSeeker) {
      return json({ success: false, error: 'Job seeker not found' }, { status: 404 });
    }
    
    // Check if relationship already exists
    const existing = await agentModel.findRelationship(auth.agentId, jobSeekerId);
    if (existing) {
      if (existing.status === 'active') {
        return json({ 
          success: false, 
          error: 'Active relationship already exists' 
        }, { status: 409 });
      }
      // Reactivate if suspended/terminated
      await agentModel.updateRelationship(existing._id!, {
        status: 'active',
        contractTerms: contractTerms || existing.contractTerms
      });
      
      return json({
        success: true,
        message: 'Relationship reactivated',
        relationship: {
          id: existing._id,
          status: 'active'
        }
      });
    }
    
    // Create new relationship
    const relationship = await agentModel.createRelationship({
      agentId: new ObjectId(auth.agentId),
      jobSeekerId: new ObjectId(jobSeekerId),
      status: 'active',
      contractTerms: contractTerms ? {
        commissionRate: contractTerms.commissionRate,
        fixedFee: contractTerms.fixedFee,
        maxApplications: contractTerms.maxApplications,
        expiresAt: contractTerms.expiresAt ? new Date(contractTerms.expiresAt) : undefined
      } : undefined
    });
    
    return json({
      success: true,
      message: 'Job seeker linked to agent successfully',
      relationship: {
        id: relationship._id,
        agentId: relationship.agentId,
        jobSeekerId: relationship.jobSeekerId,
        status: relationship.status,
        contractTerms: relationship.contractTerms
      }
    }, { status: 201 });
  } catch (error: any) {
    if (error.status) {
      return json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Link job seeker error:', error);
    return json({ success: false, error: 'Failed to link job seeker' }, { status: 500 });
  }
};

// Get agent's job seekers
export const GET: RequestHandler = async (event) => {
  try {
    const auth = await requireAgent(event);
    
    if (!auth.agentId) {
      return json({ success: false, error: 'Agent profile not found' }, { status: 404 });
    }
    
    const db = await getDB();
    const agentModel = new AgentModel(db);
    const userModel = new UserModel(db);
    
    const relationships = await agentModel.findActiveRelationshipsByAgent(auth.agentId);
    
    // Get job seeker details
    const jobSeekers = await Promise.all(
      relationships.map(async (rel) => {
        const jobSeeker = await userModel.findById(rel.jobSeekerId);
        return {
          relationshipId: rel._id,
          jobSeeker: {
            id: jobSeeker?._id,
            email: jobSeeker?.email,
            name: jobSeeker?.name
          },
          status: rel.status,
          contractTerms: rel.contractTerms,
          createdAt: rel.createdAt
        };
      })
    );
    
    return json({
      success: true,
      jobSeekers
    });
  } catch (error: any) {
    if (error.status) {
      return json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Get job seekers error:', error);
    return json({ success: false, error: 'Failed to get job seekers' }, { status: 500 });
  }
};
