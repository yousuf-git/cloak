import type { Types } from 'mongoose';
import { AuditLog, type AuditOutcome } from '../models/audit-log.model.js';
import { chainHash } from '../lib/audit-hash.js';
import { User } from '../models/user.model.js';

type Id = Types.ObjectId | string;

export interface AuditFilter {
  action?: string;
  resource?: string;
  outcome?: AuditOutcome;
  userId?: string;
  from?: Date;
  to?: Date;
  cursor?: string;
  limit: number;
}

export interface AuditEntry {
  id: string;
  action: string;
  outcome: AuditOutcome;
  actor_email: string | null;
  resource?: string;
  resource_id?: string;
  target_label?: string;
  context?: Record<string, unknown>;
  /** One-line rendering of context, so a CSV reader gets the same detail. */
  detail: string;
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
  if (filter.resource) query.resource = filter.resource;
  if (filter.outcome) query.outcome = filter.outcome;
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

/** "project=cloak-api · added=STRIPE_KEY,SENTRY_DSN" — flat by construction. */
export function describeContext(context?: Record<string, unknown>): string {
  if (!context) return '';
  return Object.entries(context)
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : String(value)}`)
    .join(' · ');
}

export async function listAuditLogs(orgId: Id, filter: AuditFilter): Promise<AuditPage> {
  const rows = await AuditLog.find(buildFilter(orgId, filter))
    .sort({ created_at: -1 })
    .limit(filter.limit + 1)
    .lean();

  const page = rows.slice(0, filter.limit);
  // Rows carry the actor's address themselves; the lookup only covers entries
  // written before that was recorded.
  const emails = await actorEmails(page.filter((r) => !r.actor_email).map((r) => r.user_id));

  return {
    entries: page.map((r) => ({
      id: r._id.toString(),
      action: r.action,
      outcome: r.outcome ?? 'success',
      actor_email: r.actor_email ?? (r.user_id ? (emails.get(r.user_id.toString()) ?? null) : null),
      resource: r.resource,
      resource_id: r.resource_id,
      target_label: r.target_label,
      context: r.context,
      detail: describeContext(r.context),
      ip: r.ip,
      user_agent: r.user_agent,
      created_at: r.created_at,
    })),
    next_cursor:
      rows.length > filter.limit ? (page[page.length - 1]?.created_at.toISOString() ?? null) : null,
  };
}

/**
 * The account's own security history: sign-ins, session revocations, 2FA and
 * recovery changes — the events an owner checks after a scare.
 *
 * Matched on the user id *or* the address, because a refused sign-in never gets
 * as far as identifying a user and would otherwise be invisible to the person
 * whose account was being guessed at.
 */
export async function listAccountLog(
  userId: Id,
  email: string,
  limit: number,
): Promise<AuditEntry[]> {
  const rows = await AuditLog.find({
    $or: [{ user_id: userId }, { actor_email: email }],
    action: { $regex: '^(auth|user):' },
  })
    .sort({ created_at: -1 })
    .limit(limit)
    .lean();

  return rows.map((r) => ({
    id: r._id.toString(),
    action: r.action,
    outcome: r.outcome ?? 'success',
    actor_email: r.actor_email ?? null,
    resource: r.resource,
    resource_id: r.resource_id,
    target_label: r.target_label,
    context: r.context,
    detail: describeContext(r.context),
    ip: r.ip,
    user_agent: r.user_agent,
    created_at: r.created_at,
  }));
}

async function actorEmails(ids: (Types.ObjectId | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is Types.ObjectId => Boolean(id)).map(String))];
  if (unique.length === 0) return new Map();
  const users = await User.find({ _id: { $in: unique } }).select('email').lean();
  return new Map(users.map((u) => [u._id.toString(), u.email]));
}

export type ChainBreak = 'hash_mismatch' | 'broken_link' | 'missing_entry';

export interface ChainVerification {
  chain_id: string;
  ok: boolean;
  entries_checked: number;
  first_seq: number | null;
  last_seq: number | null;
  /**
   * The chain no longer starts at 1, because retention expired its oldest
   * entries. Expected, and not a failure — but it does mean anything before
   * `first_seq` can no longer be proven either way.
   */
  truncated: boolean;
  broken_at: { seq: number; id: string; created_at: Date; reason: ChainBreak } | null;
}

/**
 * Walk a chain and check that every entry still hashes to what it claims, and
 * that each one points at the one before it.
 *
 * Editing a field, deleting a row, or splicing one in breaks the first check at
 * that row and the second at every row after it — so the answer is not just
 * "tampered" but "tampered at or before this entry".
 */
export async function verifyAuditChain(chainId: string): Promise<ChainVerification> {
  const cursor = AuditLog.find({ chain_id: chainId }).sort({ seq: 1 }).lean().cursor();

  let checked = 0;
  let firstSeq: number | null = null;
  let lastSeq: number | null = null;
  let expectedPrev: string | null = null;
  let broken: ChainVerification['broken_at'] = null;

  for await (const row of cursor) {
    if (firstSeq === null) firstSeq = row.seq;

    const reason: ChainBreak | null =
      lastSeq !== null && row.seq !== lastSeq + 1
        ? 'missing_entry'
        : expectedPrev !== null && row.prev_hash !== expectedPrev
          ? 'broken_link'
          : chainHash(row.prev_hash, row, row.chain_version) !== row.hash
            ? 'hash_mismatch'
            : null;

    if (reason) {
      broken = { seq: row.seq, id: row._id.toString(), created_at: row.created_at, reason };
      break;
    }

    checked += 1;
    lastSeq = row.seq;
    expectedPrev = row.hash;
  }
  await cursor.close();

  return {
    chain_id: chainId,
    ok: broken === null,
    entries_checked: checked,
    first_seq: firstSeq,
    last_seq: lastSeq,
    truncated: firstSeq !== null && firstSeq > 1,
    broken_at: broken,
  };
}

const CSV_COLUMNS = [
  'created_at',
  'action',
  'outcome',
  'actor_email',
  'resource',
  'target_label',
  'detail',
  'resource_id',
  'ip',
] as const;

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
