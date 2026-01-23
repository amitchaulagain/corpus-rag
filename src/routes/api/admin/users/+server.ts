// Admin User Management (Enhanced with RBAC)
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuthRBAC, requirePermission, requireRole } from '$lib/rbac-middleware.js';
import { getDB } from '$lib/db/mongodb.js';
import { UserModel } from '$lib/models/user.js';
import { getUserRoles, getUserPermissions } from '$lib/rbac-middleware.js';

// List all users (admin only)
export const GET: RequestHandler = async (event) => {
  try {
    // Require admin role or users:read permission
    const auth = await requirePermission(event, 'users', 'read', 'all').catch(() => 
      requireRole(event, 'admin')
    );
    
    const db = await getDB();
    const userModel = new UserModel(db);
    
    const users = await userModel.listAll();
    
    // Get RBAC data for each user
    const usersWithRBAC = await Promise.all(
      users.map(async (user) => {
        const roles = await getUserRoles(user._id!);
        const permissions = await getUserPermissions(user._id!);
        
        return {
          id: user._id,
          email: user.email,
          name: user.name,
          userType: user.userType,
          isPaid: user.isPaid,
          roles,
          permissions: permissions.length,
          departments: user.departments?.length || 0,
          primaryDepartment: user.primaryDepartmentId,
          isAgent: !!user.agentProfile?.isActive,
          agentId: user.agentProfile?.agentId,
          tokenBalance: user.tokenBalance || 0,
          totalTokensPurchased: user.totalTokensPurchased || 0,
          totalTokensUsed: user.totalTokensUsed || 0,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin
        };
      })
    );
    
    return json({
      success: true,
      users: usersWithRBAC,
      total: usersWithRBAC.length
    });
  } catch (error: any) {
    if (error.status) {
      return json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('List users error:', error);
    return json({ success: false, error: 'Failed to list users' }, { status: 500 });
  }
};
