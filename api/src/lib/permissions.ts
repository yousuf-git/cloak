import { ForbiddenError } from './errors.js';
import type { Role } from '../models/membership.model.js';

/**
 * Role capabilities.
 *
 * These are authorization rules, not cryptographic ones. Every active member of
 * an org holds the same Org DEK, so `viewer` and `member` can decrypt exactly
 * the same secrets — they differ only in what this layer lets them write. The
 * cryptographic boundary is org membership itself, nothing finer.
 */
export type Action =
  | 'vault:read'
  | 'vault:write'
  | 'member:manage'
  | 'audit:read'
  | 'org:manage'
  | 'org:own';

const CAPABILITIES: Record<Role, readonly Action[]> = {
  viewer: ['vault:read'],
  member: ['vault:read', 'vault:write'],
  admin: ['vault:read', 'vault:write', 'member:manage', 'audit:read', 'org:manage'],
  owner: ['vault:read', 'vault:write', 'member:manage', 'audit:read', 'org:manage', 'org:own'],
};

export function can(role: Role, action: Action): boolean {
  return CAPABILITIES[role].includes(action);
}

export function assertCan(role: Role, action: Action): void {
  if (!can(role, action)) {
    throw new ForbiddenError(`Your role (${role}) cannot perform this action`);
  }
}

/** Ranking used to stop an admin from acting on someone at or above their level. */
const RANK: Record<Role, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };

export function outranks(actor: Role, target: Role): boolean {
  return RANK[actor] > RANK[target];
}
