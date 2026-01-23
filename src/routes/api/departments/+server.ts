// Department Management API
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuthRBAC, requireRole, requirePermission } from '$lib/rbac-middleware.js';
import { getDB } from '$lib/db/mongodb.js';
import { DepartmentModel } from '$lib/models/department.js';
import { ObjectId } from 'mongodb';

// List all departments
export const GET: RequestHandler = async (event) => {
  try {
    // Require authentication
    const auth = await requireAuthRBAC(event);
    
    const db = await getDB();
    const departmentModel = new DepartmentModel(db);
    
    const includeInactive = event.url.searchParams.get('includeInactive') === 'true';
    const departments = await departmentModel.listAll(includeInactive);
    
    return json({
      success: true,
      departments: departments.map(dept => ({
        id: dept._id,
        name: dept.name,
        code: dept.code,
        description: dept.description,
        parentDepartmentId: dept.parentDepartmentId,
        isActive: dept.isActive,
        createdAt: dept.createdAt,
        updatedAt: dept.updatedAt
      }))
    });
  } catch (error: any) {
    if (error.status) {
      return json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('List departments error:', error);
    return json({ success: false, error: 'Failed to list departments' }, { status: 500 });
  }
};

// Create new department
export const POST: RequestHandler = async (event) => {
  try {
    // Require admin role or 'departments:create' permission
    const auth = await requirePermission(event, 'departments', 'create').catch(() => 
      requireRole(event, 'admin')
    );
    
    const { name, code, description, parentDepartmentId } = await event.request.json();
    
    if (!name || !code) {
      return json({ success: false, error: 'Name and code are required' }, { status: 400 });
    }
    
    const db = await getDB();
    const departmentModel = new DepartmentModel(db);
    
    // Check if code already exists
    const existing = await departmentModel.findByCode(code);
    if (existing) {
      return json({ success: false, error: 'Department code already exists' }, { status: 409 });
    }
    
    // Validate parent department if provided
    let parentDeptId: ObjectId | null = null;
    if (parentDepartmentId) {
      const parentDept = await departmentModel.findById(parentDepartmentId);
      if (!parentDept) {
        return json({ success: false, error: 'Parent department not found' }, { status: 404 });
      }
      parentDeptId = parentDept._id!;
    }
    
    const department = await departmentModel.create({
      name,
      code,
      description,
      parentDepartmentId: parentDeptId,
      isActive: true
    });
    
    return json({
      success: true,
      department: {
        id: department._id,
        name: department.name,
        code: department.code,
        description: department.description,
        parentDepartmentId: department.parentDepartmentId,
        isActive: department.isActive,
        createdAt: department.createdAt
      }
    }, { status: 201 });
  } catch (error: any) {
    if (error.status) {
      return json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Create department error:', error);
    return json({ success: false, error: 'Failed to create department' }, { status: 500 });
  }
};
