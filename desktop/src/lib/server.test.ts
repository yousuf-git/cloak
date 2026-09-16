import { describe, it, expect, vi } from 'vitest';

vi.mock('./api', () => ({ apiRequest: vi.fn() }));

const { decodeJoinKey } = await import('./server');

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
