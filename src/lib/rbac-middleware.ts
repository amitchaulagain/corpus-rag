// Enhanced RBAC Middleware
import type { RequestEvent } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { authenticateJwt } from './jwt-middleware.js';
import { getDB } from './db/mongodb.js';
import { UserModel, type User } from './models/user.js';
import { RoleModel, type Permission } from './models/role.js';
import { DepartmentModel } from './models/department.js';
import type { AccessTokenPayload, ServiceAccountTokenPayload } from './jwt-auth.js';
import { ObjectId } from 'mongodb';

export interface RBACAuthenticatedRequest {
  user: User;
  token: AccessTokenPayload | ServiceAccountTokenPayload;
  rateLimit: {
    remaining: number;
    resetTime: Date;
  };
  roles: string[];
  departments: string[];
  permissions: string[];
  isAgent: boolean;
  agentId?: string;
}

/**
 * Get all active roles for a user (from JWT and database)
 */
export async function getUserRoles(userId: string | ObjectId): Promise<string[]> {
  const db = await getDB();
  const userModel = new UserModel(db);
  const roleAssignments = await userModel.getActiveRoles(userId);
  return roleAssignments.map(ra => ra.role);
}

/**
 * Get all permissions for a user based on their roles
 */
export async function getUserPermissions(userId: string | ObjectId): Promise<string[]> {
  const db = await getDB();
  const roleModel = new RoleModel(db);
  const roles = await getUserRoles(userId);
  
  const allPermissions = new Set<string>();
  
  for (const roleName of roles) {
    const permissions = await roleModel.getPermissions(roleName);
    for (const perm of permissions) {
      const permString = `${perm.resource}:${perm.action}${perm.scope ? `:${perm.scope}` : ''}`;
      allPermissions.add(permString);
    }
  }
  
  return Array.from(allPermissions);
}

/**
 * Check if user has a specific permission
 */
export async function hasPermission(
  userId: string | ObjectId,
  resource: string,
  action: string,
  scope?: string
): Promise<boolean> {
  const db = await getDB();
  const roleModel = new RoleModel(db);
  const roles = await getUserRoles(userId);
  
  // Super admin has all permissions
  if (roles.includes('super_admin')) {
    return true;
  }
  
  // Check each role for the permission
  for (const roleName of roles) {
    const hasPerm = await roleModel.hasPermission(roleName, resource, action, scope);
    if (hasPerm) return true;
  }
  
  return false;
}

/**
 * Check if user has a specific role
 */
export async function hasRole(
  userId: string | ObjectId,
  roleName: string,
  departmentId?: ObjectId | null
): Promise<boolean> {
  const db = await getDB();
  const userModel = new UserModel(db);
  const roleAssignments = await userModel.getActiveRoles(userId);
  
  return roleAssignments.some(ra => {
    if (ra.role !== roleName) return false;
    if (departmentId === undefined) return true; // Any department
    if (departmentId === null) return ra.departmentId === null || ra.departmentId === undefined; // System-wide
    return ra.departmentId?.toString() === departmentId.toString();
  });
}

/**
 * Check if user has access to a department
 */
export async function hasDepartmentAccess(
  userId: string | ObjectId,
  departmentId: ObjectId | string
): Promise<boolean> {
  const db = await getDB();
  const userModel = new UserModel(db);
  const user = await userModel.findById(userId);
  
  if (!user) return false;
  
  // Super admin has access to all departments
  const roles = await getUserRoles(userId);
  if (roles.includes('super_admin')) {
    return true;
  }
  
  // Check if user belongs to the department
  const deptObjectId = typeof departmentId === 'string' ? new ObjectId(departmentId) : departmentId;
  if (user.departments?.some(d => d.toString() === deptObjectId.toString())) {
    return true;
  }
  
  // Check if user has a role in this department
  const roleAssignments = await userModel.getActiveRoles(userId);
  return roleAssignments.some(ra => 
    ra.departmentId?.toString() === deptObjectId.toString()
  );
}

/**
 * Enhanced authentication with RBAC context
 */
export async function authenticateRBAC(event: RequestEvent): Promise<RBACAuthenticatedRequest | Response> {
  const auth = await authenticateJwt(event);
  
  if (auth instanceof Response) {
    return auth;
  }
  
  const db = await getDB();
  const userModel = new UserModel(db);
  const user = await userModel.findById(auth.user.id);
  
  if (!user) {
    return new Response(JSON.stringify({
      success: false,
      error: 'User not found'
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Get roles and permissions
  const roles = await getUserRoles(user._id!);
  const departments = user.departments?.map(d => d.toString()) || [];
  const permissions = await getUserPermissions(user._id!);
  
  // Check if user is an agent
  const isAgent = !!user.agentProfile?.isActive;
  const agentId = user.agentProfile?.agentId.toString();
  
  return {
    ...auth,
    user,
    roles,
    departments,
    permissions,
    isAgent,
    agentId
  };
}

/**
 * Require authentication (enhanced with RBAC)
 */
export async function requireAuthRBAC(event: RequestEvent): Promise<RBACAuthenticatedRequest> {
  const auth = await authenticateRBAC(event);
  
  if (auth instanceof Response) {
    throw error(401, 'Authentication required');
  }
  
  return auth;
}

/**
 * Require specific role
 */
export async function requireRole(
  event: RequestEvent,
  roleName: string,
  departmentId?: ObjectId | null
): Promise<RBACAuthenticatedRequest> {
  const auth = await requireAuthRBAC(event);
  
  const hasRequiredRole = await hasRole(auth.user._id!, roleName, departmentId);
  if (!hasRequiredRole) {
    throw error(403, `Role '${roleName}' required`);
  }
  
  return auth;
}

/**
 * Require specific permission
 */
export async function requirePermission(
  event: RequestEvent,
  resource: string,
  action: string,
  scope?: string
): Promise<RBACAuthenticatedRequest> {
  const auth = await requireAuthRBAC(event);
  
  const hasRequiredPermission = await hasPermission(auth.user._id!, resource, action, scope);
  if (!hasRequiredPermission) {
    throw error(403, `Permission '${resource}:${action}' required`);
  }
  
  return auth;
}

/**
 * Require department access
 */
export async function requireDepartmentAccess(
  event: RequestEvent,
  departmentId: ObjectId | string
): Promise<RBACAuthenticatedRequest> {
  const auth = await requireAuthRBAC(event);
  
  const hasAccess = await hasDepartmentAccess(auth.user._id!, departmentId);
  if (!hasAccess) {
    throw error(403, 'Department access denied');
  }
  
  return auth;
}

/**
 * Require agent role
 */
export async function requireAgent(event: RequestEvent): Promise<RBACAuthenticatedRequest> {
  const auth = await requireAuthRBAC(event);
  
  if (!auth.isAgent) {
    throw error(403, 'Agent access required');
  }
  
  return auth;
}

/**
 * Check if user owns a resource or has access via department
 */
export async function checkResourceAccess(
  userId: string | ObjectId,
  resourceUserId: string | ObjectId,
  resourceDepartmentId?: ObjectId | string
): Promise<boolean> {
  // User owns the resource
  if (userId.toString() === resourceUserId.toString()) {
    return true;
  }
  
  // Check department access if resource has a department
  if (resourceDepartmentId) {
    return await hasDepartmentAccess(userId, resourceDepartmentId);
  }
  
  return false;
}

/**
 * Helper to format permission string
 */
export function formatPermission(resource: string, action: string, scope?: string): string {
  return `${resource}:${action}${scope ? `:${scope}` : ''}`;
}

/**
 * Helper to parse permission string
 */
export function parsePermission(permission: string): { resource: string; action: string; scope?: string } {
  const parts = permission.split(':');
  return {
    resource: parts[0],
    action: parts[1],
    scope: parts[2]
  };
}
