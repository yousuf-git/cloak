import type { Request } from 'express';
import { Types } from 'mongoose';
import { AuditLog } from '../models/audit-log.model.js';
import { logger } from '../lib/logger.js';

interface AuditInput {
  action: string;
  userId?: Types.ObjectId | string | null;
  resource?: string;
  resourceId?: string;
  req?: Request;
}

/**
 * Record a sensitive-mutation audit entry (metadata only — never secret
 * payloads). Failures are logged but never block the request flow.
 */
export async function recordAudit({ action, userId, resource, resourceId, req }: AuditInput): Promise<void> {
  try {
    await AuditLog.create({
      user_id: userId ? new Types.ObjectId(userId) : undefined,
      action,
      resource,
      resource_id: resourceId,
      ip: req?.ip,
      user_agent: req?.headers['user-agent'],
    });
  } catch (err) {
    logger.warn({ err, action }, 'Failed to write audit log');
  }
}
