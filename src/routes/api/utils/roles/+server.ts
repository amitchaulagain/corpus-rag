// Role Check Utility Endpoint
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuthRBAC, hasRole } from '$lib/rbac-middleware.js';
import { ObjectId } from 'mongodb';

export const POST: RequestHandler = async (event) => {
  try {
    const auth = await requireAuthRBAC(event);
    
    const { role, departmentId, userId } = await event.request.json();
    
    if (!role) {
      return json({ 
        success: false, 
        error: 'role is required' 
      }, { status: 400 });
    }
    
    // Check role for specified user or current user
    const targetUserId = userId ? new ObjectId(userId) : auth.user._id!;
    
    // Only allow checking own roles unless admin
    if (targetUserId.toString() !== auth.user._id!.toString()) {
      const { requireRole } = await import('$lib/rbac-middleware.js');
      await requireRole(event, 'admin').catch(() => {
        throw { status: 403, message: 'Permission denied' };
      });
    }
    
    const deptObjectId = departmentId ? new ObjectId(departmentId) : null;
    const hasRoleCheck = await hasRole(targetUserId, role, deptObjectId);
    
    return json({
      success: true,
      hasRole: hasRoleCheck,
      user: {
        id: targetUserId.toString(),
        email: auth.user.email
      },
      role: {
        name: role,
        departmentId: departmentId || null
      }
    });
  } catch (error: any) {
    if (error.status) {
      return json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Check role error:', error);
    return json({ success: false, error: 'Failed to check role' }, { status: 500 });
  }
};
