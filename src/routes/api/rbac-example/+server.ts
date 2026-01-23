// Example API endpoints demonstrating RBAC usage
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { 
  requireAuthRBAC, 
  requireRole, 
  requirePermission, 
  requireAgent,
  requireDepartmentAccess 
} from '$lib/rbac-middleware.js';
import { getDB } from '$lib/db/mongodb.js';
import { ObjectId } from 'mongodb';

// Example 1: Simple authentication check
export const GET: RequestHandler = async (event) => {
  try {
    // Just require authentication - any logged-in user can access
    const auth = await requireAuthRBAC(event);
    
    return json({
      success: true,
      message: 'You are authenticated!',
      user: {
        id: auth.user._id,
        email: auth.user.email,
        roles: auth.roles,
        departments: auth.departments,
        permissions: auth.permissions
      }
    });
  } catch (error: any) {
    return json({ 
      success: false, 
      error: error.message || 'Authentication required' 
    }, { status: 401 });
  }
};

// Example 2: Require specific role
export const POST: RequestHandler = async (event) => {
  try {
    // Only agents can access this endpoint
    const auth = await requireAgent(event);
    
    return json({
      success: true,
      message: 'Agent access granted!',
      agentId: auth.agentId,
      user: auth.user.email
    });
  } catch (error: any) {
    return json({ 
      success: false, 
      error: error.message || 'Agent access required' 
    }, { status: 403 });
  }
};
