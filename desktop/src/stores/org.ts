import { create } from 'zustand';
import { crypto } from '@/lib/tauri-crypto';
import { api, orgApi, setActiveOrgId, type OrgDto, type Role } from '@/lib/api';

const LAST_ORG_KEY = 'cloak:last-org';

interface OrgState {
  orgs: OrgDto[];
  activeOrgId: string | null;
  /**
   * This device's own identity public key, derived in the Rust core from the
   * unwrapped secret half — never taken from the server's copy. That matters:
   * the fingerprint shown to the user has to come from the key they actually
   * hold, or it proves nothing about a substituted one.
   */
  identityPublicKey: string | null;
  /** Orgs whose DEK failed to open — visible in the list but not usable. */
  lockedOrgIds: string[];
  loading: boolean;
  error: string | null;

  /** After unlock: load the identity key, then every org key it can open. */
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  setActive: (orgId: string) => void;
  createOrg: (name: string) => Promise<string>;
  reset: () => void;
}

export const useOrgs = create<OrgState>((set, get) => ({
  orgs: [],
  activeOrgId: null,
  identityPublicKey: null,
  lockedOrgIds: [],
  loading: false,
  error: null,

  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      // An account created before teams has no identity keypair yet; mint one
      // now, while the DEK that wraps it is in memory.
      const me = await api.me();
      let publicKey: string;
      if (me.wrapped_identity_sk) {
        // Returns the public half recomputed from the decrypted secret key. A
        // server that tampered with the wrap would fail the AEAD check here.
        publicKey = await crypto.loadIdentity(me.wrapped_identity_sk);
      } else {
        const identity = await crypto.createIdentity();
        await api.publishIdentity(identity.identity_public_key, identity.wrapped_identity_sk_b64);
        publicKey = identity.identity_public_key;
      }
      set({ identityPublicKey: publicKey });

      await get().refresh();
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Could not load teams' });
    }
  },

  refresh: async () => {
    const orgs = await orgApi.list();
    const locked: string[] = [];

    for (const org of orgs) {
      // A pending membership has no wrap to open yet; that is expected, not a
      // failure, so it must not be reported as locked.
      if (org.status !== 'active') continue;
      try {
        await crypto.loadOrg(org.id, org.wrapped_org_dek);
      } catch {
        // A membership whose key wrap will not open: the org lists, but its
        // secrets stay unreadable until an admin re-grants the key.
        locked.push(org.id);
      }
    }

    const remembered = readLastOrg();
    const usable = orgs.filter((o) => o.status === 'active' && !locked.includes(o.id));
    // Never land on a pending org: every vault request against it would 403.
    const fallback = orgs.find((o) => o.status === 'active');
    const active = usable.find((o) => o.id === remembered)?.id ?? usable[0]?.id ?? fallback?.id ?? null;

    setActiveOrgId(active);
    set({ orgs, lockedOrgIds: locked, activeOrgId: active, loading: false, error: null });
  },

  setActive: (orgId) => {
    const target = get().orgs.find((o) => o.id === orgId);
    if (!target || target.status !== 'active') return;
    writeLastOrg(orgId);
    setActiveOrgId(orgId);
    set({ activeOrgId: orgId });
  },

  createOrg: async (name) => {
    const material = await crypto.bootstrapOrg();
    const org = await orgApi.create({
      name,
      wrapped_org_dek: material.wrapped_org_dek_b64,
      org_recovery_salt: material.org_recovery_salt_b64,
      org_recovery_wrappedDEK: material.org_recovery_wrapped_dek_b64,
    });
    await crypto.loadOrg(org.id, material.wrapped_org_dek_b64);
    await get().refresh();
    get().setActive(org.id);
    // The caller shows this once and then drops it — it is never stored.
    return material.org_recovery_key;
  },

  reset: () => {
    setActiveOrgId(null);
    set({
      orgs: [],
      activeOrgId: null,
      identityPublicKey: null,
      lockedOrgIds: [],
      loading: false,
      error: null,
    });
  },
}));

export function activeRole(): Role | null {
  const { orgs, activeOrgId } = useOrgs.getState();
  return orgs.find((o) => o.id === activeOrgId)?.role ?? null;
}

function readLastOrg(): string | null {
  try {
    return localStorage.getItem(LAST_ORG_KEY);
  } catch {
    return null;
  }
}

function writeLastOrg(orgId: string): void {
  try {
    localStorage.setItem(LAST_ORG_KEY, orgId);
  } catch {
    // Preference only — losing it just means falling back to the first org.
  }
}
