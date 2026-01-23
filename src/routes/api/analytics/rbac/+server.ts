// RBAC Analytics Endpoint
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireRole } from '$lib/rbac-middleware.js';
import { getDB } from '$lib/db/mongodb.js';
import { UserModel } from '$lib/models/user.js';
import { RoleModel } from '$lib/models/role.js';
import { DepartmentModel } from '$lib/models/department.js';
import { AgentModel } from '$lib/models/agent.js';
import { AuditLogModel } from '$lib/models/audit-log.js';

export const GET: RequestHandler = async (event) => {
  try {
    // Require admin role
    const auth = await requireRole(event, 'admin');
    
    const db = await getDB();
    const userModel = new UserModel(db);
    const roleModel = new RoleModel(db);
    const departmentModel = new DepartmentModel(db);
    const agentModel = new AgentModel(db);
    const auditLogModel = new AuditLogModel(db);
    
    // Get all data
    const users = await userModel.listAll();
    const roles = await roleModel.listAll();
    const departments = await departmentModel.listAll(true);
    const agents = await agentModel.listAll(true);
    
    // Role distribution
    const roleDistribution: Record<string, number> = {};
    users.forEach(user => {
      if (user.roles) {
        user.roles.forEach(ra => {
          if (ra.isActive) {
            roleDistribution[ra.role] = (roleDistribution[ra.role] || 0) + 1;
          }
        });
      }
    });
    
    // Department distribution
    const departmentDistribution: Record<string, number> = {};
    users.forEach(user => {
      if (user.departments) {
        user.departments.forEach(deptId => {
          const dept = departments.find(d => d._id!.toString() === deptId.toString());
          if (dept) {
            departmentDistribution[dept.name] = (departmentDistribution[dept.name] || 0) + 1;
          }
        });
      }
    });
    
    // Agent statistics
    const agentStats = {
      total: agents.length,
      active: agents.filter(a => a.isActive).length,
      totalApplications: 0, // Would need to query agent_applications
      totalCommissions: 0 // Would need to calculate from charges
    };
    
    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentLogs = await auditLogModel.findInDateRange(thirtyDaysAgo, new Date(), 1000);
    
    const activityByAction: Record<string, number> = {};
    recentLogs.forEach(log => {
      activityByAction[log.action] = (activityByAction[log.action] || 0) + 1;
    });
    
    return json({
      success: true,
      analytics: {
        users: {
          total: users.length,
          withRoles: users.filter(u => u.roles && u.roles.length > 0).length,
          agents: users.filter(u => u.agentProfile?.isActive).length,
          byType: {
            admin: users.filter(u => u.userType === 'admin').length,
            premium: users.filter(u => u.userType === 'premium').length,
            freetier: users.filter(u => u.userType === 'freetier').length
          }
        },
        roles: {
          total: roles.length,
          distribution: roleDistribution,
          systemRoles: roles.filter(r => r.isSystemRole).length,
          customRoles: roles.filter(r => !r.isSystemRole).length
        },
        departments: {
          total: departments.length,
          active: departments.filter(d => d.isActive).length,
          distribution: departmentDistribution
        },
        agents: agentStats,
        activity: {
          last30Days: {
            totalActions: recentLogs.length,
            byAction: activityByAction
          }
        }
      },
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    if (error.status) {
      return json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Get RBAC analytics error:', error);
    return json({ success: false, error: 'Failed to get analytics' }, { status: 500 });
  }
};
