import { useOrgs } from '@/stores/org';
import { useAppMode } from '@/stores/app-mode';
import { CAPABILITIES, type Capability } from '@/lib/roles';

export type { Capability };

/**
 * Active org plus what the signed-in user may do in it. The server enforces the
 * same matrix — this only decides what the UI offers.
 */
export function useOrg() {
  const sandbox = useAppMode((s) => s.sandbox);
  const orgs = useOrgs((s) => s.orgs);
  const activeOrgId = useOrgs((s) => s.activeOrgId);
  const lockedOrgIds = useOrgs((s) => s.lockedOrgIds);

  const active = orgs.find((o) => o.id === activeOrgId) ?? null;
  const role = sandbox ? 'owner' : (active?.role ?? null);

  return {
    orgs,
    org: active,
    orgId: activeOrgId,
    role,
    isLocked: activeOrgId !== null && lockedOrgIds.includes(activeOrgId),
    can: (capability: Capability) => (role ? CAPABILITIES[role].includes(capability) : false),
  };
}
