// Department Management - Single Department
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuthRBAC, requirePermission, requireRole } from '$lib/rbac-middleware.js';
import { getDB } from '$lib/db/mongodb.js';
import { DepartmentModel } from '$lib/models/department.js';
import { ObjectId } from 'mongodb';

// Get single department
export const GET: RequestHandler = async (event) => {
  try {
    const auth = await requireAuthRBAC(event);
    const departmentId = event.params.id;
    
    if (!departmentId) {
      return json({ success: false, error: 'Department ID required' }, { status: 400 });
    }
    
    const db = await getDB();
    const departmentModel = new DepartmentModel(db);
    
    const department = await departmentModel.findById(departmentId);
    if (!department) {
      return json({ success: false, error: 'Department not found' }, { status: 404 });
    }
    
    // Get child departments
    const children = await departmentModel.listByParent(department._id!);
    
    return json({
      success: true,
      department: {
        id: department._id,
        name: department.name,
        code: department.code,
        description: department.description,
        parentDepartmentId: department.parentDepartmentId,
        isActive: department.isActive,
        children: children.map(c => ({
          id: c._id,
          name: c.name,
          code: c.code
        })),
        createdAt: department.createdAt,
        updatedAt: department.updatedAt
      }
    });
  } catch (error: any) {
    if (error.status) {
      return json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Get department error:', error);
    return json({ success: false, error: 'Failed to get department' }, { status: 500 });
  }
};

// Update department
export const PUT: RequestHandler = async (event) => {
  try {
    // Require admin role or 'departments:update' permission
    const auth = await requirePermission(event, 'departments', 'update').catch(() => 
      requireRole(event, 'admin')
    );
    
    const departmentId = event.params.id;
    const { name, code, description, parentDepartmentId, isActive } = await event.request.json();
    
    if (!departmentId) {
      return json({ success: false, error: 'Department ID required' }, { status: 400 });
    }
    
    const db = await getDB();
    const departmentModel = new DepartmentModel(db);
    
    // Check if department exists
    const existing = await departmentModel.findById(departmentId);
    if (!existing) {
      return json({ success: false, error: 'Department not found' }, { status: 404 });
    }
    
    // Validate parent department if provided
    let parentDeptId: ObjectId | null | undefined = undefined;
    if (parentDepartmentId !== undefined) {
      if (parentDepartmentId === null) {
        parentDeptId = null;
      } else {
        const parentDept = await departmentModel.findById(parentDepartmentId);
        if (!parentDept) {
          return json({ success: false, error: 'Parent department not found' }, { status: 404 });
        }
        // Prevent circular reference
        if (parentDept._id!.toString() === departmentId) {
          return json({ success: false, error: 'Cannot set department as its own parent' }, { status: 400 });
        }
        parentDeptId = parentDept._id!;
      }
    }
    
    // Check if code is being changed and if it conflicts
    if (code && code !== existing.code) {
      const codeExists = await departmentModel.findByCode(code);
      if (codeExists) {
        return json({ success: false, error: 'Department code already exists' }, { status: 409 });
      }
    }
    
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (code !== undefined) updates.code = code;
    if (description !== undefined) updates.description = description;
    if (parentDeptId !== undefined) updates.parentDepartmentId = parentDeptId;
    if (isActive !== undefined) updates.isActive = isActive;
    
    const updated = await departmentModel.update(departmentId, updates);
    
    if (!updated) {
      return json({ success: false, error: 'Failed to update department' }, { status: 500 });
    }
    
    const updatedDept = await departmentModel.findById(departmentId);
    
    return json({
      success: true,
      department: {
        id: updatedDept!._id,
        name: updatedDept!.name,
        code: updatedDept!.code,
        description: updatedDept!.description,
        parentDepartmentId: updatedDept!.parentDepartmentId,
        isActive: updatedDept!.isActive,
        updatedAt: updatedDept!.updatedAt
      }
    });
  } catch (error: any) {
    if (error.status) {
      return json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Update department error:', error);
    return json({ success: false, error: 'Failed to update department' }, { status: 500 });
  }
};

// Delete department (soft delete)
export const DELETE: RequestHandler = async (event) => {
  try {
    // Require admin role or 'departments:delete' permission
    const auth = await requirePermission(event, 'departments', 'delete').catch(() => 
      requireRole(event, 'admin')
    );
    
    const departmentId = event.params.id;
    
    if (!departmentId) {
      return json({ success: false, error: 'Department ID required' }, { status: 400 });
    }
    
    const db = await getDB();
    const departmentModel = new DepartmentModel(db);
    
    try {
      await departmentModel.delete(departmentId);
      return json({ success: true, message: 'Department deleted successfully' });
    } catch (error: any) {
      if (error.message.includes('child departments')) {
        return json({ success: false, error: error.message }, { status: 400 });
      }
      throw error;
    }
  } catch (error: any) {
    if (error.status) {
      return json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Delete department error:', error);
    return json({ success: false, error: 'Failed to delete department' }, { status: 500 });
  }
};
