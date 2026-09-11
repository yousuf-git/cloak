import { createHash } from 'node:crypto';
import type { Types } from 'mongoose';

/** The `prev_hash` of the first entry in a chain. */
export const GENESIS_HASH = '0'.repeat(64);

/**
 * Bumped only when the hashed field set changes. Old rows keep the version they
 * were written under, so a format change cannot silently invalidate them — the
 * verifier hashes each row with its own version.
 */
export const CHAIN_VERSION = 1;

export interface ChainableEntry {
  chain_id: string;
  seq: number;
  created_at: Date;
  action: string;
  outcome: 'success' | 'failure';
  org_id?: Types.ObjectId;
  user_id?: Types.ObjectId;
  actor_email?: string;
  resource?: string;
  resource_id?: string;
  target_label?: string;
  context?: Record<string, unknown>;
  ip?: string;
  user_agent?: string;
}

/** JSON with object keys in sorted order, so the same entry always hashes alike. */
function canonical(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * The entry's hash, covering both its own content and the hash before it.
 *
 * Changing any field of a row, or removing a row, breaks every hash after it —
 * which is the whole point: the trail is append-only by construction rather
 * than by convention.
 */
export function chainHash(prevHash: string, entry: ChainableEntry, version = CHAIN_VERSION): string {
  const payload = {
    v: version,
    prev: prevHash,
    chain_id: entry.chain_id,
    seq: entry.seq,
    created_at: entry.created_at,
    action: entry.action,
    outcome: entry.outcome,
    org_id: entry.org_id ? String(entry.org_id) : undefined,
    user_id: entry.user_id ? String(entry.user_id) : undefined,
    actor_email: entry.actor_email,
    resource: entry.resource,
    resource_id: entry.resource_id,
    target_label: entry.target_label,
    context: entry.context,
    ip: entry.ip,
    user_agent: entry.user_agent,
  };
  return createHash('sha256').update(canonical(payload)).digest('hex');
}
