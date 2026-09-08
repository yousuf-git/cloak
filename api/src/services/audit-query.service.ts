import type { Types } from 'mongoose';
import { AuditLog } from '../models/audit-log.model.js';
import { User } from '../models/user.model.js';

type Id = Types.ObjectId | string;

export interface AuditFilter {
  action?: string;
  userId?: string;
  from?: Date;
  to?: Date;
  cursor?: string;
  limit: number;
}

export interface AuditEntry {
  id: string;
  action: string;
  actor_email: string | null;
  resource?: string;
  resource_id?: string;
  ip?: string;
  user_agent?: string;
  created_at: Date;
}

export interface AuditPage {
  entries: AuditEntry[];
  next_cursor: string | null;
}

function buildFilter(orgId: Id, filter: AuditFilter): Record<string, unknown> {
  const query: Record<string, unknown> = { org_id: orgId };
  if (filter.action) query.action = filter.action;
  if (filter.userId) query.user_id = filter.userId;

  // Keyset pagination on the { org_id, created_at: -1 } index: the cursor is
  // the timestamp of the last row returned, so pages stay stable as rows arrive.
  const createdAt: Record<string, Date> = {};
  if (filter.from) createdAt.$gte = filter.from;
  if (filter.to) createdAt.$lte = filter.to;
  if (filter.cursor) {
    const cursorDate = new Date(filter.cursor);
    if (!Number.isNaN(cursorDate.getTime())) createdAt.$lt = cursorDate;
  }
  if (Object.keys(createdAt).length > 0) query.created_at = createdAt;

  return query;
}

export async function listAuditLogs(orgId: Id, filter: AuditFilter): Promise<AuditPage> {
  const rows = await AuditLog.find(buildFilter(orgId, filter))
    .sort({ created_at: -1 })
    .limit(filter.limit + 1)
    .lean();

  const page = rows.slice(0, filter.limit);
  const emails = await actorEmails(page.map((r) => r.user_id));

  return {
    entries: page.map((r) => ({
      id: r._id.toString(),
      action: r.action,
      actor_email: r.user_id ? (emails.get(r.user_id.toString()) ?? null) : null,
      resource: r.resource,
      resource_id: r.resource_id,
      ip: r.ip,
      user_agent: r.user_agent,
      created_at: r.created_at,
    })),
    next_cursor:
      rows.length > filter.limit ? (page[page.length - 1]?.created_at.toISOString() ?? null) : null,
  };
}

async function actorEmails(ids: (Types.ObjectId | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is Types.ObjectId => Boolean(id)).map(String))];
  if (unique.length === 0) return new Map();
  const users = await User.find({ _id: { $in: unique } }).select('email').lean();
  return new Map(users.map((u) => [u._id.toString(), u.email]));
}

const CSV_COLUMNS = ['created_at', 'action', 'actor_email', 'resource', 'resource_id', 'ip'] as const;

/** Escape a CSV cell, including the leading-character guard against formula injection. */
function csvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const guarded = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export function toCsv(entries: AuditEntry[]): string {
  const header = CSV_COLUMNS.join(',');
  const rows = entries.map((e) =>
    CSV_COLUMNS.map((c) => csvCell(c === 'created_at' ? e.created_at.toISOString() : e[c])).join(','),
  );
  return [header, ...rows].join('\n');
}
