// Audit Service - Helper for logging actions
import { getDB } from '../db/mongodb.js';
import { AuditLogModel, type AuditAction } from '../models/audit-log.js';
import { ObjectId } from 'mongodb';

export class AuditService {
  private static instance: AuditService;
  private auditLogModel: AuditLogModel | null = null;

  private constructor() {}

  static async getInstance(): Promise<AuditService> {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
      const db = await getDB();
      AuditService.instance.auditLogModel = new AuditLogModel(db);
    }
    return AuditService.instance;
  }

  async log(
    action: AuditAction,
    resourceType: string,
    options: {
      userId?: string | ObjectId;
      resourceId?: string | ObjectId;
      description: string;
      changes?: Record<string, any>;
      metadata?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    if (!this.auditLogModel) {
      const db = await getDB();
      this.auditLogModel = new AuditLogModel(db);
    }

    await this.auditLogModel.create({
      userId: options.userId ? (typeof options.userId === 'string' ? new ObjectId(options.userId) : options.userId) : undefined,
      action,
      resourceType,
      resourceId: options.resourceId ? (typeof options.resourceId === 'string' ? new ObjectId(options.resourceId) : options.resourceId) : undefined,
      details: {
        description: options.description,
        changes: options.changes,
        metadata: options.metadata
      },
      ipAddress: options.ipAddress,
      userAgent: options.userAgent
    });
  }

  // Convenience methods
  async logRoleAssignment(
    userId: string | ObjectId,
    targetUserId: string | ObjectId,
    role: string,
    departmentId?: string | ObjectId,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log('role_assigned', 'user', {
      userId,
      resourceId: targetUserId,
      description: `Role '${role}' assigned to user`,
      metadata: { role, departmentId: departmentId?.toString() },
      ipAddress,
      userAgent
    });
  }

  async logRoleRemoval(
    userId: string | ObjectId,
    targetUserId: string | ObjectId,
    role: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log('role_removed', 'user', {
      userId,
      resourceId: targetUserId,
      description: `Role '${role}' removed from user`,
      metadata: { role },
      ipAddress,
      userAgent
    });
  }

  async logAgentApplication(
    agentId: string | ObjectId,
    applicationId: string | ObjectId,
    jobSeekerId: string | ObjectId,
    chargeAmount: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log('agent_application_submitted', 'agent_application', {
      userId: agentId,
      resourceId: applicationId,
      description: `Agent submitted application on behalf of job seeker`,
      metadata: {
        jobSeekerId: jobSeekerId.toString(),
        chargeAmount
      },
      ipAddress,
      userAgent
    });
  }

  async logCharge(
    userId: string | ObjectId,
    chargeAmount: number,
    transactionId: string | ObjectId,
    metadata?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log('charge_processed', 'transaction', {
      userId,
      resourceId: transactionId,
      description: `Charge processed: ${chargeAmount} tokens`,
      metadata: {
        amount: chargeAmount,
        ...metadata
      },
      ipAddress,
      userAgent
    });
  }

  async logRefund(
    userId: string | ObjectId,
    refundAmount: number,
    transactionId: string | ObjectId,
    reason: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log('charge_refunded', 'transaction', {
      userId,
      resourceId: transactionId,
      description: `Refund processed: ${refundAmount} tokens - ${reason}`,
      metadata: {
        amount: refundAmount,
        reason
      },
      ipAddress,
      userAgent
    });
  }
}

// Export singleton instance getter
export async function getAuditService(): Promise<AuditService> {
  return await AuditService.getInstance();
}
