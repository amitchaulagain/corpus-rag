// Audit Log Statistics
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requirePermission, requireRole } from '$lib/rbac-middleware.js';
import { getDB } from '$lib/db/mongodb.js';
import { AuditLogModel } from '$lib/models/audit-log.js';

export const GET: RequestHandler = async (event) => {
  try {
    // Require admin role or audit:read permission
    const auth = await requirePermission(event, 'audit', 'read').catch(() => 
      requireRole(event, 'admin')
    );
    
    const db = await getDB();
    const auditLogModel = new AuditLogModel(db);
    
    const startDate = event.url.searchParams.get('startDate');
    const endDate = event.url.searchParams.get('endDate');
    
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    
    const statistics = await auditLogModel.getStatistics(start, end);
    
    return json({
      success: true,
      statistics,
      period: {
        startDate: start?.toISOString(),
        endDate: end?.toISOString()
      }
    });
  } catch (error: any) {
    if (error.status) {
      return json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Get audit statistics error:', error);
    return json({ success: false, error: 'Failed to get audit statistics' }, { status: 500 });
  }
};
