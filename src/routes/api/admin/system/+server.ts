// Admin System Management Endpoint
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireRole } from '$lib/rbac-middleware.js';
import { getDB } from '$lib/db/mongodb.js';
import { UserModel } from '$lib/models/user.js';
import { RoleModel } from '$lib/models/role.js';
import { DepartmentModel } from '$lib/models/department.js';
import { AgentModel } from '$lib/models/agent.js';
import { getUserRoles, getUserPermissions } from '$lib/rbac-middleware.js';

// Get system statistics (admin only)
export const GET: RequestHandler = async (event) => {
  try {
    // Require super_admin role
    const auth = await requireRole(event, 'super_admin');
    
    const db = await getDB();
    const userModel = new UserModel(db);
    const roleModel = new RoleModel(db);
    const departmentModel = new DepartmentModel(db);
    const agentModel = new AgentModel(db);

    // Get all users
    const users = await userModel.listAll();
    
    // Get all roles
    const roles = await roleModel.listAll();
    
    // Get all departments
    const departments = await departmentModel.listAll(true);
    
    // Get all agents
    const agents = await agentModel.listAll(true);

    // Calculate statistics
    const userStats = {
      total: users.length,
      byType: {
        admin: users.filter(u => u.userType === 'admin').length,
        premium: users.filter(u => u.userType === 'premium').length,
        freetier: users.filter(u => u.userType === 'freetier').length
      },
      withRoles: users.filter(u => u.roles && u.roles.length > 0).length,
      agents: users.filter(u => u.agentProfile?.isActive).length
    };

    // Count users by role
    const roleCounts: Record<string, number> = {};
    for (const user of users) {
      if (user.roles) {
        for (const roleAssignment of user.roles) {
          if (roleAssignment.isActive) {
            roleCounts[roleAssignment.role] = (roleCounts[roleAssignment.role] || 0) + 1;
          }
        }
      }
    }

    // Department statistics
    const departmentStats = {
      total: departments.length,
      active: departments.filter(d => d.isActive).length,
      inactive: departments.filter(d => !d.isActive).length,
      withUsers: departments.filter(d => {
        return users.some(u => u.departments?.some(deptId => deptId.toString() === d._id!.toString()));
      }).length
    };

    // Agent statistics
    const agentStats = {
      total: agents.length,
      active: agents.filter(a => a.isActive).length,
      inactive: agents.filter(a => !a.isActive).length
    };

    return json({
      success: true,
      system: {
        users: userStats,
        roles: {
          total: roles.length,
          systemRoles: roles.filter(r => r.isSystemRole).length,
          customRoles: roles.filter(r => !r.isSystemRole).length,
          roleCounts
        },
        departments: departmentStats,
        agents: agentStats
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    if (error.status) {
      return json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Get system stats error:', error);
    return json({ success: false, error: 'Failed to get system statistics' }, { status: 500 });
  }
};
