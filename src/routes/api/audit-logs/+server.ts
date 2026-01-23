// Audit Logs API
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuthRBAC, requirePermission, requireRole } from '$lib/rbac-middleware.js';
import { getDB } from '$lib/db/mongodb.js';
import { AuditLogModel } from '$lib/models/audit-log.js';
import { ObjectId } from 'mongodb';

// Get audit logs
export const GET: RequestHandler = async (event) => {
  try {
    // Require admin role or audit:read permission
    const auth = await requirePermission(event, 'audit', 'read').catch(() => 
      requireRole(event, 'admin')
    );
    
    const db = await getDB();
    const auditLogModel = new AuditLogModel(db);
    
    const userId = event.url.searchParams.get('userId');
    const action = event.url.searchParams.get('action') as any;
    const resourceType = event.url.searchParams.get('resourceType');
    const resourceId = event.url.searchParams.get('resourceId');
    const startDate = event.url.searchParams.get('startDate');
    const endDate = event.url.searchParams.get('endDate');
    const limit = parseInt(event.url.searchParams.get('limit') || '100');
    
    let logs: any[] = [];
    
    if (userId) {
      logs = await auditLogModel.findByUser(userId, limit);
    } else if (action) {
      logs = await auditLogModel.findByAction(action, limit);
    } else if (resourceType && resourceId) {
      logs = await auditLogModel.findByResource(resourceType, resourceId, limit);
    } else if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const end = endDate ? new Date(endDate) : new Date();
      logs = await auditLogModel.findInDateRange(start, end, limit);
    } else {
      logs = await auditLogModel.findRecent(limit);
    }
    
    return json({
      success: true,
      logs: logs.map(log => ({
        id: log._id,
        userId: log.userId,
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        details: log.details,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        timestamp: log.timestamp
      })),
      count: logs.length
    });
  } catch (error: any) {
    if (error.status) {
      return json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Get audit logs error:', error);
    return json({ success: false, error: 'Failed to get audit logs' }, { status: 500 });
  }
};
