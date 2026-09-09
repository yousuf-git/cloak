import { config } from '../config/index.js';

/**
 * One string that carries both halves a new member needs: which server to talk
 * to, and the invitation token to redeem there.
 *
 * Two separate fields meant typing a URL by hand, and a mistyped host is the one
 * error the client cannot explain well — it just fails to connect. Bundling them
 * makes the whole onboarding a single paste.
 *
 * Not a secret container: the token inside is the secret, and it is already
 * bound to one email address and expires. The encoding is for correctness, not
 * confidentiality.
 */
export function encodeJoinKey(token: string, serverUrl: string = config.publicUrl): string {
  const payload = JSON.stringify({ u: serverUrl, t: token });
  return `cloak_${Buffer.from(payload, 'utf8').toString('base64url')}`;
}
