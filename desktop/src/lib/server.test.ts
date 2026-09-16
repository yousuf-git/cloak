import { describe, it, expect, vi } from 'vitest';

vi.mock('./api', () => ({ apiRequest: vi.fn() }));

const { decodeJoinKey, probeServer } = await import('./server');
const { APP_VERSION, MIN_SERVER_VERSION } = await import('./version');

describe('decodeJoinKey', () => {
  it('unpacks the server and token from a key the API issued', () => {
    // A real key from a local backend: base64url, no padding.
    const key =
      'cloak_eyJ1IjoiaHR0cDovL2xvY2FsaG9zdDo0NzgyMSIsInQiOiJYUkdfQzNmNDZ0OUV2aTJzMHJzVGw0UkxWY0tFaUYxUDZIWS1GSDFtcGFJIn0';
    expect(decodeJoinKey(`  ${key}\n`)).toEqual({
      url: expect.stringContaining('localhost:47821'),
      token: 'XRG_C3f46t9Evi2s0rsTl4RLVcKEiF1P6HY-FH1mpaI',
    });
  });

  it('returns null for anything that is not a join key', () => {
    expect(decodeJoinKey('XRG_C3f46t9Evi2s0rsTl4RLVcKEiF1P6HY-FH1mpaI')).toBeNull();
    expect(decodeJoinKey('cloak_not-base64-json')).toBeNull();
  });
});

describe('probeServer version bounds', () => {
  const info = (overrides: Record<string, unknown>) => ({
    name: 'Cloak Server',
    server_version: APP_VERSION,
    api_contract: 1,
    min_client_version: MIN_SERVER_VERSION,
    ownership_claimed: true,
    checks: { database: true, email: true },
    public_url_unset: false,
    ...overrides,
  });
  const answer = (body: object) =>
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: body }), { status: 200 }));

  it('accepts a server within both bounds', async () => {
    answer(info({}));
    expect((await probeServer('https://vault.test/api/v1')).ok).toBe(true);
  });

  it('says the app needs updating when the server no longer serves this version', async () => {
    answer(info({ min_client_version: '999.0.0' }));
    expect(await probeServer('https://vault.test/api/v1')).toMatchObject({ ok: false, reason: 'app_outdated' });
  });

  it('says the server needs updating when it is older than this app supports', async () => {
    answer(info({ server_version: '0.0.1' }));
    expect(await probeServer('https://vault.test/api/v1')).toMatchObject({ ok: false, reason: 'server_outdated' });
  });
});
