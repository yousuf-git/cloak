import type { Request } from 'express';
import { Types } from 'mongoose';
import { AuditLog, type AuditOutcome } from '../models/audit-log.model.js';
import { CHAIN_VERSION, GENESIS_HASH, chainHash, type ChainableEntry } from '../lib/audit-hash.js';
import { logger } from '../lib/logger.js';

interface AuditInput {
  action: string;
  orgId?: Types.ObjectId | string | null;
  userId?: Types.ObjectId | string | null;
  /** Overrides the address on the access token — used when there is no token yet. */
  actorEmail?: string | null;
  outcome?: AuditOutcome;
  resource?: string;
  resourceId?: string;
  targetLabel?: string | null;
  context?: Record<string, unknown> | null;
  req?: Request;
}

const MAX_STRING = 120;
const MAX_ITEMS = 25;

function clampString(value: string): string {
  return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING - 1)}…` : value;
}

/**
 * Keep context small, flat and printable.
 *
 * Everything here ends up in an exportable CSV that org admins read, so it
 * holds only descriptors a caller chose deliberately: names, counts, field
 * names, role transitions. Nested objects are dropped rather than flattened,
 * which is what stops a whole request body from being passed in by accident.
 */
function sanitizeContext(context?: Record<string, unknown> | null): Record<string, unknown> | undefined {
  if (!context) return undefined;
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(context)) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'string') clean[key] = clampString(value);
    else if (typeof value === 'number' || typeof value === 'boolean') clean[key] = value;
    else if (Array.isArray(value)) {
      const items = value
        .filter((v): v is string | number => typeof v === 'string' || typeof v === 'number')
        .slice(0, MAX_ITEMS)
        .map((v) => (typeof v === 'string' ? clampString(v) : v));
      if (items.length > 0) {
        clean[key] = items;
        if (value.length > MAX_ITEMS) clean[`${key}_truncated`] = value.length - MAX_ITEMS;
      }
    }
  }

  return Object.keys(clean).length > 0 ? clean : undefined;
}

function toObjectId(value?: Types.ObjectId | string | null): Types.ObjectId | undefined {
  if (!value) return undefined;
  return value instanceof Types.ObjectId ? value : new Types.ObjectId(value);
}

/**
 * Entries that belong to an organization chain together under it; the rest —
 * sign-ins, session revocations, profile changes — chain under `account`,
 * because they happen to a person and not inside any one org.
 */
function chainIdFor(orgId?: Types.ObjectId): string {
  return orgId ? orgId.toString() : 'account';
}

function isDuplicateSeq(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

/** How many times to re-read the head when another writer wins the race. */
const CHAIN_RETRIES = 5;

/**
 * Append one entry to its chain.
 *
 * The unique `{ chain_id, seq }` index is the lock: a writer reads the current
 * head, hashes its entry against it, and inserts. Two writers that read the
 * same head both try to claim the same seq, one insert fails, and the loser
 * re-reads rather than forking the chain. The insert is the commit, so a failed
 * write leaves no gap behind.
 */
async function appendToChain(entry: Omit<ChainableEntry, 'chain_id' | 'seq'>): Promise<void> {
  const chainId = chainIdFor(entry.org_id);

  for (let attempt = 1; attempt <= CHAIN_RETRIES; attempt += 1) {
    const head = await AuditLog.findOne({ chain_id: chainId })
      .sort({ seq: -1 })
      .select('seq hash')
      .lean();

    const row = {
      ...entry,
      chain_id: chainId,
      seq: (head?.seq ?? 0) + 1,
      prev_hash: head?.hash ?? GENESIS_HASH,
    };

    try {
      await AuditLog.create({
        ...row,
        chain_version: CHAIN_VERSION,
        hash: chainHash(row.prev_hash, row),
      });
      return;
    } catch (err) {
      if (!isDuplicateSeq(err) || attempt === CHAIN_RETRIES) throw err;
    }
  }
}

/**
 * Record a sensitive-mutation audit entry (metadata only — never secret
 * payloads). Actor identity defaults to the access token on the request, so a
 * call site only names it when the two differ. Failures are logged but never
 * block the request flow.
 */
export async function recordAudit({
  action,
  orgId,
  userId,
  actorEmail,
  outcome = 'success',
  resource,
  resourceId,
  targetLabel,
  context,
  req,
}: AuditInput): Promise<void> {
  try {
    await appendToChain({
      // Set here, not by the timestamp plugin: the hash has to cover the same
      // instant the row stores.
      created_at: new Date(),
      org_id: toObjectId(orgId ?? req?.org?.id),
      user_id: toObjectId(userId ?? req?.user?.sub),
      actor_email: actorEmail ?? req?.user?.email,
      action,
      outcome,
      resource,
      resource_id: resourceId,
      target_label: targetLabel ?? undefined,
      context: sanitizeContext(context),
      ip: req?.ip,
      user_agent: req?.headers['user-agent'],
    });
  } catch (err) {
    logger.warn({ err, action }, 'Failed to write audit log');
  }
}
