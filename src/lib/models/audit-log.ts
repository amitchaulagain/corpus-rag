// Audit Log Model - Track all RBAC and system actions
import { ObjectId, type Db } from 'mongodb';

export type AuditAction = 
  | 'role_assigned'
  | 'role_removed'
  | 'department_created'
  | 'department_updated'
  | 'department_deleted'
  | 'user_created'
  | 'user_updated'
  | 'agent_registered'
  | 'agent_application_submitted'
  | 'charge_processed'
  | 'charge_refunded'
  | 'permission_granted'
  | 'permission_revoked'
  | 'login'
  | 'logout'
  | 'token_purchased'
  | 'token_deducted';

export interface AuditLog {
  _id?: ObjectId;
  userId?: ObjectId;              // User who performed the action
  action: AuditAction;
  resourceType: string;          // e.g., 'user', 'role', 'department', 'agent'
  resourceId?: ObjectId;         // ID of the resource affected
  details: {
    description: string;
    changes?: Record<string, any>;  // Before/after values
    metadata?: Record<string, any>;  // Additional context
  };
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export class AuditLogModel {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async create(logData: Omit<AuditLog, '_id' | 'timestamp'>): Promise<AuditLog> {
    const log: AuditLog = {
      ...logData,
      timestamp: new Date()
    };

    const result = await this.db.collection<AuditLog>('audit_logs').insertOne(log);
    return { ...log, _id: result.insertedId };
  }

  async findByUser(userId: string | ObjectId, limit = 100): Promise<AuditLog[]> {
    const objectId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    return await this.db.collection<AuditLog>('audit_logs')
      .find({ userId: objectId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }

  async findByAction(action: AuditAction, limit = 100): Promise<AuditLog[]> {
    return await this.db.collection<AuditLog>('audit_logs')
      .find({ action })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }

  async findByResource(resourceType: string, resourceId: string | ObjectId, limit = 100): Promise<AuditLog[]> {
    const objectId = typeof resourceId === 'string' ? new ObjectId(resourceId) : resourceId;
    return await this.db.collection<AuditLog>('audit_logs')
      .find({ resourceType, resourceId: objectId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }

  async findRecent(limit = 100): Promise<AuditLog[]> {
    return await this.db.collection<AuditLog>('audit_logs')
      .find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }

  async findInDateRange(startDate: Date, endDate: Date, limit = 1000): Promise<AuditLog[]> {
    return await this.db.collection<AuditLog>('audit_logs')
      .find({
        timestamp: {
          $gte: startDate,
          $lte: endDate
        }
      })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }

  // Get audit statistics
  async getStatistics(startDate?: Date, endDate?: Date): Promise<{
    total: number;
    byAction: Record<string, number>;
    byResourceType: Record<string, number>;
    byUser: Array<{ userId: ObjectId; count: number }>;
  }> {
    const matchStage: any = {};
    if (startDate || endDate) {
      matchStage.timestamp = {};
      if (startDate) matchStage.timestamp.$gte = startDate;
      if (endDate) matchStage.timestamp.$lte = endDate;
    }

    const pipeline = [
      { $match: matchStage },
      {
        $facet: {
          total: [{ $count: 'count' }],
          byAction: [
            { $group: { _id: '$action', count: { $sum: 1 } } },
            { $project: { action: '$_id', count: 1, _id: 0 } }
          ],
          byResourceType: [
            { $group: { _id: '$resourceType', count: { $sum: 1 } } },
            { $project: { resourceType: '$_id', count: 1, _id: 0 } }
          ],
          byUser: [
            { $match: { userId: { $exists: true, $ne: null } } },
            { $group: { _id: '$userId', count: { $sum: 1 } } },
            { $project: { userId: '$_id', count: 1, _id: 0 } },
            { $sort: { count: -1 } },
            { $limit: 10 }
          ]
        }
      }
    ];

    const result = await this.db.collection<AuditLog>('audit_logs').aggregate(pipeline).toArray();
    const stats = result[0] || {};

    return {
      total: stats.total?.[0]?.count || 0,
      byAction: (stats.byAction || []).reduce((acc: Record<string, number>, item: any) => {
        acc[item.action] = item.count;
        return acc;
      }, {}),
      byResourceType: (stats.byResourceType || []).reduce((acc: Record<string, number>, item: any) => {
        acc[item.resourceType] = item.count;
        return acc;
      }, {}),
      byUser: (stats.byUser || []).map((item: any) => ({
        userId: item.userId,
        count: item.count
      }))
    };
  }
}
