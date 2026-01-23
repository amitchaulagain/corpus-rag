// Role Model and Types
import { ObjectId, type Db } from 'mongodb';

export interface Permission {
  resource: string;      // e.g., "jobs", "applications", "users", "billing"
  action: string;        // e.g., "create", "read", "update", "delete", "apply"
  scope?: string;        // "own", "department", "all"
}

export interface Role {
  _id?: ObjectId;
  name: string;                      // Unique role name (e.g., "super_admin", "agent")
  displayName: string;                // Human-readable name
  description?: string;
  permissions: Permission[];         // Array of permissions
  isSystemRole: boolean;             // Cannot be deleted
  departmentSpecific: boolean;       // Can only be assigned within departments
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleAssignment {
  role: string;                      // Role name
  departmentId?: ObjectId | null;    // null = system-wide role
  grantedBy: ObjectId;                // User who granted this role
  grantedAt: Date;
  expiresAt?: Date;                   // Optional expiry
  isActive: boolean;
}

export class RoleModel {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async create(roleData: Omit<Role, '_id' | 'createdAt' | 'updatedAt'>): Promise<Role> {
    const role: Role = {
      ...roleData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await this.db.collection<Role>('roles').insertOne(role);
    return { ...role, _id: result.insertedId };
  }

  async findByName(name: string): Promise<Role | null> {
    return await this.db.collection<Role>('roles').findOne({ name });
  }

  async findById(id: string | ObjectId): Promise<Role | null> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    return await this.db.collection<Role>('roles').findOne({ _id: objectId });
  }

  async listAll(): Promise<Role[]> {
    return await this.db.collection<Role>('roles').find().toArray();
  }

  async listSystemRoles(): Promise<Role[]> {
    return await this.db.collection<Role>('roles').find({ isSystemRole: true }).toArray();
  }

  async update(id: string | ObjectId, updates: Partial<Omit<Role, '_id' | 'createdAt'>>): Promise<boolean> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    const result = await this.db.collection<Role>('roles').updateOne(
      { _id: objectId },
      { 
        $set: { 
          ...updates,
          updatedAt: new Date()
        }
      }
    );
    return result.modifiedCount > 0;
  }

  async delete(id: string | ObjectId): Promise<boolean> {
    const objectId = typeof id === 'string' ? new ObjectId(id) : id;
    // Prevent deletion of system roles
    const role = await this.findById(objectId);
    if (role?.isSystemRole) {
      throw new Error('Cannot delete system role');
    }
    const result = await this.db.collection<Role>('roles').deleteOne({ _id: objectId });
    return result.deletedCount > 0;
  }

  // Get all permissions for a role
  async getPermissions(roleName: string): Promise<Permission[]> {
    const role = await this.findByName(roleName);
    return role?.permissions || [];
  }

  // Check if role has specific permission
  async hasPermission(roleName: string, resource: string, action: string, scope?: string): Promise<boolean> {
    const permissions = await this.getPermissions(roleName);
    return permissions.some(p => 
      p.resource === resource && 
      p.action === action && 
      (scope === undefined || p.scope === scope || p.scope === 'all')
    );
  }
}
