import type { Role } from '@/lib/api';

export type Capability =
  | 'vault:read'
  | 'vault:write'
  | 'member:manage'
  | 'audit:read'
  | 'org:manage'
  | 'org:own';

/**
 * Mirrors `api/src/lib/permissions.ts`. The server is what actually enforces
 * this; here it decides what the UI offers, and what the roles table shows —
 * both read the same map so the explanation cannot drift from the behaviour.
 */
export const CAPABILITIES: Record<Role, readonly Capability[]> = {
  viewer: ['vault:read'],
  member: ['vault:read', 'vault:write'],
  admin: ['vault:read', 'vault:write', 'member:manage', 'audit:read', 'org:manage'],
  owner: ['vault:read', 'vault:write', 'member:manage', 'audit:read', 'org:manage', 'org:own'],
};

/** Roles weakest-first, the order the permissions table reads across. */
export const ROLE_ORDER: readonly Role[] = ['viewer', 'member', 'admin', 'owner'];

/** Plain-language name for each capability, for the roles overview. */
export const CAPABILITY_LABELS: Record<Capability, { title: string; detail: string }> = {
  'vault:read': {
    title: 'View and decrypt secrets',
    detail: 'Open any credential, key or env file in this organization',
  },
  'vault:write': {
    title: 'Add, edit and delete secrets',
    detail: 'Including projects',
  },
  'member:manage': {
    title: 'Manage members',
    detail: 'Invite, grant keys, change roles, remove people',
  },
  'audit:read': {
    title: 'Read the audit log',
    detail: 'Including CSV export',
  },
  'org:manage': {
    title: 'Rename the organization',
    detail: 'Edit organization settings',
  },
  'org:own': {
    title: 'Delete or transfer the organization',
    detail: 'Also break-glass recovery with the org recovery key',
  },
};

/** Assignable roles, in the order the picker offers them. Owner moves by transfer. */
export const ROLE_OPTIONS = [
  { value: 'viewer', label: 'Viewer — read only' },
  { value: 'member', label: 'Member — read and edit' },
  { value: 'admin', label: 'Admin — manage the team' },
];

export const roleTone: Record<Role, 'brand' | 'green' | 'amber' | 'neutral'> = {
  owner: 'brand',
  admin: 'amber',
  member: 'green',
  viewer: 'neutral',
};

/** Most authority first, so a member list reads top-down by seniority. */
const ROLE_RANK: Record<Role, number> = { owner: 0, admin: 1, member: 2, viewer: 3 };

export function byRole<T extends { role: Role; email: string }>(a: T, b: T): number {
  return ROLE_RANK[a.role] - ROLE_RANK[b.role] || a.email.localeCompare(b.email);
}
