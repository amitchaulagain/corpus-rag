// Permission Check Utility Endpoint
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuthRBAC, hasPermission } from '$lib/rbac-middleware.js';
import { ObjectId } from 'mongodb';

export const POST: RequestHandler = async (event) => {
  try {
    const auth = await requireAuthRBAC(event);
    
    const { resource, action, scope, userId } = await event.request.json();
    
    if (!resource || !action) {
      return json({ 
        success: false, 
        error: 'resource and action are required' 
      }, { status: 400 });
    }
    
    // Check permission for specified user or current user
    const targetUserId = userId ? new ObjectId(userId) : auth.user._id!;
    
    // Only allow checking own permissions unless admin
    if (targetUserId.toString() !== auth.user._id!.toString()) {
      const { requireRole } = await import('$lib/rbac-middleware.js');
      await requireRole(event, 'admin').catch(() => {
        throw { status: 403, message: 'Permission denied' };
      });
    }
    
    const hasPerm = await hasPermission(targetUserId, resource, action, scope);
    
    return json({
      success: true,
      hasPermission: hasPerm,
      user: {
        id: targetUserId.toString(),
        email: auth.user.email
      },
      permission: {
        resource,
        action,
        scope: scope || 'any'
      }
    });
  } catch (error: any) {
    if (error.status) {
      return json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Check permission error:', error);
    return json({ success: false, error: 'Failed to check permission' }, { status: 500 });
  }
};
