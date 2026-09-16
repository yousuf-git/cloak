import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/tauri-crypto', () => ({
  crypto: {
    prepareSignup: vi.fn(async () => ({
      auth_hash_b64: 'auth',
      crypto_salt_b64: 'salt',
      wrapped_dek_b64: 'dek',
      recovery_wrapped_dek_b64: 'recovery-dek',
      identity_public_key: 'identity-pk',
      wrapped_identity_sk_b64: 'identity-sk',
      recovery_key: 'recovery-key',
      org: {
        wrapped_org_dek_b64: 'org-dek',
        org_recovery_salt_b64: 'org-salt',
        org_recovery_wrapped_dek_b64: 'org-recovery-dek',
        org_recovery_key: 'org-recovery-key',
      },
    })),
  },
}));

vi.mock('@/lib/api', () => ({
  api: { signup: vi.fn(async () => ({})) },
  orgApi: {},
  ApiError: class ApiError extends Error {},
  clearTokens: vi.fn(),
  getRefreshToken: vi.fn(),
  onAuthLostHandler: vi.fn(),
  onRefreshRotatedHandler: vi.fn(),
  setActiveOrgId: vi.fn(),
  setApiBaseUrl: vi.fn(),
  setTokens: vi.fn(),
  tryRefresh: vi.fn(),
  apiRequest: vi.fn(),
}));

const { useAuth } = await import('./auth');
const { useServers } = await import('./server');
const { needsOnboarding } = await import('@/components/auth/OnboardingScreen');

const UNCLAIMED = {
  name: 'Cloak Server',
  server_version: '0.3.0',
  api_contract: 1,
  min_client_version: '0.2.0',
  ownership_claimed: false,
  checks: { database: true, email: true },
  public_url_unset: false,
};

/** The screen App.tsx would pick, from the same state it reads. */
function onboardingShown(): boolean {
  const { activeId, info } = useServers.getState();
  return needsOnboarding(activeId, info, useAuth.getState().claimTicket);
}

describe('claiming a fresh server', () => {
  beforeEach(() => {
    useServers.setState({ activeId: 'local', info: UNCLAIMED });
    useAuth.setState({ status: 'locked', claimTicket: null });
  });

  it('moves on to the recovery keys after the owner signs up, not back to the claim step', async () => {
    expect(onboardingShown()).toBe(true);

    useAuth.getState().setOnboarding({ claimTicket: 'ticket' });
    expect(onboardingShown()).toBe(false);

    await useAuth.getState().signup('Owner', 'owner@example.com', 'correct horse battery', false);

    expect(useAuth.getState().status).toBe('show_recovery_key');
    expect(useAuth.getState().claimTicket).toBeNull();
    expect(onboardingShown()).toBe(false);
  });

  it('leaves the claim step in place when no claim was made', async () => {
    await useAuth.getState().signup('Someone', 'someone@example.com', 'correct horse battery', false);
    expect(useServers.getState().info?.ownership_claimed).toBe(false);
    expect(onboardingShown()).toBe(true);
  });
});
