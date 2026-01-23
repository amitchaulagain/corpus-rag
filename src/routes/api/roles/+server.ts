// Role Management API
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuthRBAC, requireRole } from '$lib/rbac-middleware.js';
import { getDB } from '$lib/db/mongodb.js';
import { RoleModel, type Permission } from '$lib/models/role.js';

// List all roles
export const GET: RequestHandler = async (event) => {
  try {
    // Require authentication
    const auth = await requireAuthRBAC(event);
    
    const db = await getDB();
    const roleModel = new RoleModel(db);
    
    const roles = await roleModel.listAll();
    
    return json({
      success: true,
      roles: roles.map(role => ({
        id: role._id,
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        permissions: role.permissions,
        isSystemRole: role.isSystemRole,
        departmentSpecific: role.departmentSpecific,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt
      }))
    });
  } catch (error: any) {
    if (error.status) {
      return json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('List roles error:', error);
    return json({ success: false, error: 'Failed to list roles' }, { status: 500 });
  }
};

// Create new role (admin only)
export const POST: RequestHandler = async (event) => {
  try {
    // Require super_admin role
    const auth = await requireRole(event, 'super_admin');
    
    const { name, displayName, description, permissions, departmentSpecific } = await event.request.json();
    
    if (!name || !displayName) {
      return json({ success: false, error: 'Name and displayName are required' }, { status: 400 });
    }
    
    if (!permissions || !Array.isArray(permissions)) {
      return json({ success: false, error: 'Permissions array is required' }, { status: 400 });
    }
    
    const db = await getDB();
    const roleModel = new RoleModel(db);
    
    // Check if role already exists
    const existing = await roleModel.findByName(name);
    if (existing) {
      return json({ success: false, error: 'Role already exists' }, { status: 409 });
    }
    
    // Validate permissions format
    for (const perm of permissions) {
      if (!perm.resource || !perm.action) {
        return json({ 
          success: false, 
          error: 'Each permission must have resource and action' 
        }, { status: 400 });
      }
    }
    
    const role = await roleModel.create({
      name,
      displayName,
      description,
      permissions: permissions as Permission[],
      isSystemRole: false, // Custom roles are not system roles
      departmentSpecific: departmentSpecific ?? false
    });
    
    return json({
      success: true,
      role: {
        id: role._id,
        name: role.name,
        displayName: role.displayName,
        description: role.description,
        permissions: role.permissions,
        isSystemRole: role.isSystemRole,
        departmentSpecific: role.departmentSpecific,
        createdAt: role.createdAt
      }
    }, { status: 201 });
  } catch (error: any) {
    if (error.status) {
      return json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Create role error:', error);
    return json({ success: false, error: 'Failed to create role' }, { status: 500 });
  }
};
