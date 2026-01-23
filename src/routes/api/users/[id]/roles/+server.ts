// User Role Assignment API
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuthRBAC, requireRole, requirePermission } from '$lib/rbac-middleware.js';
import { getDB } from '$lib/db/mongodb.js';
import { UserModel } from '$lib/models/user.js';
import { RoleModel } from '$lib/models/role.js';
import { getAuditService } from '$lib/services/audit-service.js';
import { ObjectId } from 'mongodb';

// Get user's roles
export const GET: RequestHandler = async (event) => {
  try {
    const auth = await requireAuthRBAC(event);
    const userId = event.params.id;
    
    if (!userId) {
      return json({ success: false, error: 'User ID required' }, { status: 400 });
    }
    
    // Users can view their own roles, or require admin permission
    if (userId !== auth.user._id!.toString()) {
      await requirePermission(event, 'users', 'read').catch(() => 
        requireRole(event, 'admin')
      );
    }
    
    const db = await getDB();
    const userModel = new UserModel(db);
    
    const user = await userModel.findById(userId);
    if (!user) {
      return json({ success: false, error: 'User not found' }, { status: 404 });
    }
    
    const roles = await userModel.getActiveRoles(userId);
    
    return json({
      success: true,
      userId,
      roles: roles.map(ra => ({
        role: ra.role,
        departmentId: ra.departmentId,
        grantedBy: ra.grantedBy,
        grantedAt: ra.grantedAt,
        expiresAt: ra.expiresAt,
        isActive: ra.isActive
      }))
    });
  } catch (error: any) {
    if (error.status) {
      return json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Get user roles error:', error);
    return json({ success: false, error: 'Failed to get user roles' }, { status: 500 });
  }
};

// Assign role to user
export const POST: RequestHandler = async (event) => {
  try {
    // Require admin role or 'roles:assign' permission
    const auth = await requirePermission(event, 'roles', 'assign').catch(() => 
      requireRole(event, 'admin')
    );
    
    const userId = event.params.id;
    const { role, departmentId, expiresAt } = await event.request.json();
    
    if (!userId || !role) {
      return json({ success: false, error: 'User ID and role are required' }, { status: 400 });
    }
    
    const db = await getDB();
    const userModel = new UserModel(db);
    const roleModel = new RoleModel(db);
    
    // Verify user exists
    const user = await userModel.findById(userId);
    if (!user) {
      return json({ success: false, error: 'User not found' }, { status: 404 });
    }
    
    // Verify role exists
    const roleDef = await roleModel.findByName(role);
    if (!roleDef) {
      return json({ success: false, error: 'Role not found' }, { status: 404 });
    }
    
    // Check if role is department-specific
    if (roleDef.departmentSpecific && !departmentId) {
      return json({ 
        success: false, 
        error: 'This role requires a department assignment' 
      }, { status: 400 });
    }
    
    // Validate department if provided
    let deptObjectId: ObjectId | null = null;
    if (departmentId) {
      const { DepartmentModel } = await import('$lib/models/department.js');
      const departmentModel = new DepartmentModel(db);
      const dept = await departmentModel.findById(departmentId);
      if (!dept) {
        return json({ success: false, error: 'Department not found' }, { status: 404 });
      }
      deptObjectId = dept._id!;
    }
    
    // Check if user already has this role in this department
    const existingRoles = await userModel.getActiveRoles(userId);
    const hasRole = existingRoles.some(ra => {
      if (ra.role !== role) return false;
      if (departmentId) {
        return ra.departmentId?.toString() === departmentId;
      }
      return ra.departmentId === null || ra.departmentId === undefined;
    });
    
    if (hasRole) {
      return json({ 
        success: false, 
        error: 'User already has this role' 
      }, { status: 409 });
    }
    
    // Assign role
    const roleAssignment = {
      role,
      departmentId: deptObjectId,
      grantedBy: auth.user._id!,
      grantedAt: new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      isActive: true
    };
    
    await userModel.assignRole(userId, roleAssignment);
    
    // Add user to department if department specified
    if (deptObjectId) {
      await userModel.addDepartment(userId, deptObjectId);
    }
    
    // Log role assignment
    const auditService = await getAuditService();
    await auditService.logRoleAssignment(
      auth.user._id!,
      userId,
      role,
      departmentId,
      event.getClientAddress(),
      event.request.headers.get('user-agent') || undefined
    );
    
    return json({
      success: true,
      message: 'Role assigned successfully',
      roleAssignment
    }, { status: 201 });
  } catch (error: any) {
    if (error.status) {
      return json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Assign role error:', error);
    return json({ success: false, error: 'Failed to assign role' }, { status: 500 });
  }
};

// Remove role from user
export const DELETE: RequestHandler = async (event) => {
  try {
    // Require admin role or 'roles:assign' permission
    const auth = await requirePermission(event, 'roles', 'assign').catch(() => 
      requireRole(event, 'admin')
    );
    
    const userId = event.params.id;
    const { role, departmentId } = await event.request.json();
    
    if (!userId || !role) {
      return json({ success: false, error: 'User ID and role are required' }, { status: 400 });
    }
    
    const db = await getDB();
    const userModel = new UserModel(db);
    
    // Verify user exists
    const user = await userModel.findById(userId);
    if (!user) {
      return json({ success: false, error: 'User not found' }, { status: 404 });
    }
    
    // Remove role
    const deptObjectId = departmentId ? new ObjectId(departmentId) : null;
    await userModel.removeRole(userId, role, deptObjectId);
    
    // Log role removal
    const auditService = await getAuditService();
    await auditService.logRoleRemoval(
      auth.user._id!,
      userId,
      role,
      event.getClientAddress(),
      event.request.headers.get('user-agent') || undefined
    );
    
    return json({
      success: true,
      message: 'Role removed successfully'
    });
  } catch (error: any) {
    if (error.status) {
      return json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Remove role error:', error);
    return json({ success: false, error: 'Failed to remove role' }, { status: 500 });
  }
};
