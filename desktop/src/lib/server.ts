import { apiRequest } from './api';

/** What `GET /server/info` reports. Everything here is unauthenticated. */
export interface ServerInfo {
  name: string;
  server_version: string;
  api_contract: number;
  min_client_version: string;
  ownership_claimed: boolean;
  checks: { database: boolean; email: boolean };
  public_url_unset: boolean;
}

/** The API contract this build speaks. Must match the server's. */
export const CLIENT_API_CONTRACT = 1;

const API_PREFIX = '/api/v1';

/**
 * Turn what someone types into a base URL we can call.
 *
 * People paste an origin, a full API path, or a bare hostname. All three should
 * work, because the alternative is an error message about a trailing slash.
 */
export function normalizeServerUrl(input: string): { url: string; origin: string } | null {
  const trimmed = input.trim().replace(/\/+$/, '');
  if (!trimmed) return null;

  // A bare host is far more likely to be a real server than a relative path.
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }
  if (!parsed.hostname) return null;

  const path = parsed.pathname.replace(/\/+$/, '');
  const base = path.endsWith(API_PREFIX) ? `${parsed.origin}${path}` : `${parsed.origin}${API_PREFIX}`;
  return { url: base, origin: parsed.origin };
}

/**
 * Plain HTTP is allowed only where it cannot cross an untrusted network.
 *
 * Vault contents are ciphertext either way, but the refresh token and the
 * authHash are not: on the open internet they need TLS. A LAN address, loopback,
 * or a Tailscale CGNAT address is already confined or already encrypted.
 */
export function isInsecureUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return true;
  }
  if (parsed.protocol === 'https:') return false;

  const host = parsed.hostname;
  if (host === 'localhost' || host === '::1' || host.endsWith('.local')) return false;

  const octets = host.split('.').map(Number);
  if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = octets as [number, number, number, number];
  if (a === 127 || a === 10) return false;
  if (a === 192 && b === 168) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  // 100.64/10 — the range Tailscale hands out, where the tunnel is the encryption.
  if (a === 100 && b >= 64 && b <= 127) return false;
  return true;
}

export type ProbeResult =
  | { ok: true; info: ServerInfo }
  | { ok: false; title: string; detail: string };

const PROBE_TIMEOUT_MS = 8000;

/**
 * Ask a candidate address whether it is a healthy Cloak server.
 *
 * Every failure returns a specific cause and the thing to do about it. A
 * self-hoster who mistypes a port should not be left staring at "network error"
 * with no idea whether the problem is the address, TLS, or their database.
 */
export async function probeServer(baseUrl: string): Promise<ProbeResult> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/server/info`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    return {
      ok: false,
      title: timedOut ? 'The server did not answer' : 'Could not reach that address',
      detail: timedOut
        ? 'It accepted the connection but never replied. The server may be starting up, or a firewall may be swallowing the response.'
        : 'Check the address and port, that the server is running, and that this machine can reach it. On a public host the certificate must also be valid.',
    };
  }

  if (res.status === 404) {
    return {
      ok: false,
      title: 'That address is not a Cloak server',
      detail: 'Something answered, but not the Cloak API. Check for a typo, and make sure you are pointing at the API rather than a different service on the same host.',
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      title: `The server answered with an error (${res.status})`,
      detail: 'It is reachable but not healthy. Open its status page in a browser to see which dependency is failing.',
    };
  }

  let info: ServerInfo;
  try {
    info = (await res.json()).data as ServerInfo;
    if (typeof info?.api_contract !== 'number') throw new Error('shape');
  } catch {
    return {
      ok: false,
      title: 'That address is not a Cloak server',
      detail: 'It replied, but not with anything Cloak recognises.',
    };
  }

  if (info.api_contract !== CLIENT_API_CONTRACT) {
    const stale = info.api_contract > CLIENT_API_CONTRACT;
    return {
      ok: false,
      title: stale ? 'This app is too old for that server' : 'That server is too old for this app',
      detail: stale
        ? `The server speaks API ${info.api_contract} and this app speaks ${CLIENT_API_CONTRACT}. Update Cloak to version ${info.min_client_version} or newer.`
        : `This app speaks API ${CLIENT_API_CONTRACT} and the server speaks ${info.api_contract}. Ask whoever runs it to update the server.`,
    };
  }

  if (!info.checks.database) {
    return {
      ok: false,
      title: 'The server cannot reach its database',
      detail: 'Cloak is running but Mongo is not answering, so nothing will work. Check MONGODB_URI and any IP allowlist on the database.',
    };
  }

  return { ok: true, info };
}

export interface JoinKey {
  url: string;
  token: string;
}

/**
 * Unpack an invitation's join key into the server it names and the token it
 * carries. Returns null for anything that is not one, so the connect screen can
 * treat a pasted address and a pasted key as the same input.
 */
export function decodeJoinKey(input: string): JoinKey | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('cloak_')) return null;
  try {
    const b64 = trimmed.slice('cloak_'.length).replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64)) as { u?: unknown; t?: unknown };
    if (typeof payload.u !== 'string' || typeof payload.t !== 'string') return null;
    const normalized = normalizeServerUrl(payload.u);
    if (!normalized) return null;
    return { url: normalized.url, token: payload.t };
  } catch {
    return null;
  }
}

/** Exchange the ownership key for a short-lived ticket that signup can spend. */
export function claimOwnership(ownershipKey: string): Promise<{ claim_ticket: string }> {
  return apiRequest<{ claim_ticket: string }>('/server/claim', {
    method: 'POST',
    body: { ownership_key: ownershipKey },
  });
}
