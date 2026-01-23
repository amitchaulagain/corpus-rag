// Department Model and Types
import { ObjectId, type Db } from 'mongodb';

export interface Department {
  _id?: ObjectId;
  name: string;                    // e.g., "Engineering", "Sales", "HR"
  code: string;                    // Unique code: "ENG", "SALES", "HR" (uppercase)
  description?: string;
  parentDepartmentId?: ObjectId | null;   // For hierarchical departments
  isActive: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export class DepartmentModel {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async create(departmentData: Omit<Department, '_id' | 'createdAt' | 'updatedAt'>): Promise<Department> {
    // Normalize code to uppercase
    const department: Department = {
      ...departmentData,
      code: departmentData.code.toUpperCase(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await this.db.collection<Department>('departments').insertOne(department);
    return { ...department, _id: result.insertedId };
  }

  async findByCode(code: string): Promise<Department | null> {
    return await this.db.collection<Department>('departments').findOne({ 
      code: code.toUpperCase() 
    });
  }

  async findById(id: string | ObjectId): Promise<Department | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return await this.db.collection<Department>('departments').findOne({ _id: objectId });
  }

  async listAll(includeInactive = false): Promise<Department[]> {
    const query = includeInactive ? {} : { isActive: true };
    return await this.db.collection<Department>('departments').find(query).toArray();
  }

  async listByParent(parentId: string | ObjectId | null): Promise<Department[]> {
    const objectId = parentId ? (typeof parentId === 'string' ? new ObjectId(parentId) : parentId) : null;
    const query = objectId ? { parentDepartmentId: objectId } : { parentDepartmentId: null };
    return await this.db.collection<Department>('departments').find(query).toArray();
  }

  async update(id: string | ObjectId, updates: Partial<Omit<Department, '_id' | 'createdAt'>>): Promise<boolean> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const updateData: any = { ...updates, updatedAt: new Date() };
    
    // Normalize code if being updated
    if (updates.code) {
      updateData.code = updates.code.toUpperCase();
    }

    const result = await this.db.collection<Department>('departments').updateOne(
      { _id: objectId },
      { $set: updateData }
    );
    return result.modifiedCount > 0;
  }

  async delete(id: string | ObjectId): Promise<boolean> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    // Check if department has children
    const children = await this.listByParent(objectId);
    if (children.length > 0) {
      throw new Error('Cannot delete department with child departments');
    }
    // Soft delete by setting isActive to false
    const result = await this.db.collection<Department>('departments').updateOne(
      { _id: objectId },
      { $set: { isActive: false, updatedAt: new Date() } }
    );
    return result.modifiedCount > 0;
  }

  // Get all child departments recursively
  async getChildDepartments(parentId: string | ObjectId, includeSelf = false): Promise<Department[]> {
    const objectId = typeof parentId === 'string' ? new ObjectId(parentId) : parentId;
    const departments: Department[] = [];
    
    if (includeSelf) {
      const parent = await this.findById(objectId);
      if (parent) departments.push(parent);
    }

    const directChildren = await this.listByParent(objectId);
    for (const child of directChildren) {
      departments.push(child);
      const grandchildren = await this.getChildDepartments(child._id!, false);
      departments.push(...grandchildren);
    }

    return departments;
  }
}
