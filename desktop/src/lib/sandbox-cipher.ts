import { toBase64, fromBase64 } from './base64';

/**
 * Reversible, encrypted-looking transform used ONLY in Sandbox mode so demo
 * secrets render as ciphertext (matching the real app) yet can still be
 * "decrypted" on demand. Never used for real vault data.
 */
const MARKER = '\u0000cloak\u0000';

export function sbEncrypt(plaintext: string): string {
  return toBase64(MARKER + plaintext);
}

export function sbDecrypt(cipher: string): string {
  try {
    const decoded = fromBase64(cipher);
    return decoded.startsWith(MARKER) ? decoded.slice(MARKER.length) : decoded;
  } catch {
    // Already plaintext (e.g. legacy sandbox item) — return as-is.
    return cipher;
  }
}
