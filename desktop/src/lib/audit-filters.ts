/** What the audit views can be narrowed by. Empty strings mean "any". */
export interface AuditFilters {
  q: string;
  area: string;
  userId: string;
  outcome: '' | 'success' | 'failure';
  range: '' | '24h' | '7d' | '30d' | '90d';
}

export const NO_FILTERS: AuditFilters = { q: '', area: '', userId: '', outcome: '', range: '' };

/** Mirrors the server's audit areas (`AUDIT_AREAS` in audit-query.service). */
export const AREA_OPTIONS = [
  { value: '', label: 'All areas' },
  { value: 'env', label: 'Env files' },
  { value: 'cred', label: 'Credentials' },
  { value: 'apikey', label: 'API keys' },
  { value: 'accesskey', label: 'Access keys' },
  { value: 'sshkey', label: 'SSH keys' },
  { value: 'platform', label: 'Backup codes' },
  { value: 'project', label: 'Projects' },
  { value: 'member', label: 'Team' },
  { value: 'org', label: 'Organization' },
];

export const OUTCOME_OPTIONS = [
  { value: '', label: 'Any outcome' },
  { value: 'success', label: 'Succeeded' },
  { value: 'failure', label: 'Failed' },
];

export const RANGE_OPTIONS = [
  { value: '', label: 'Any time' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

const RANGE_MS: Record<Exclude<AuditFilters['range'], ''>, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
};

export const PAGE_SIZES = [20, 50, 100] as const;

/**
 * Query parameters for the audit endpoints. `now` is passed in rather than read
 * here: a time range is relative, and the caller decides the instant it is
 * relative to — at request time, not at every render.
 */
export function auditParams(filters: AuditFilters, now: number): Record<string, string> {
  const params: Record<string, string> = {};
  const q = filters.q.trim();
  if (q) params.q = q;
  if (filters.area) params.area = filters.area;
  if (filters.userId) params.user_id = filters.userId;
  if (filters.outcome) params.outcome = filters.outcome;
  if (filters.range) params.from = new Date(now - RANGE_MS[filters.range]).toISOString();
  return params;
}

export function isFiltered(filters: AuditFilters): boolean {
  return Object.values(filters).some((v) => v.trim() !== '');
}
