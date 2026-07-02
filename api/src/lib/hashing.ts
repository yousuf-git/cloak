import argon2 from 'argon2';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * Server-side hash of the client-provided authHash. The raw master password is
 * never seen here — we only ever hash the already-derived authHash again with a
 * per-record Argon2id salt, so a DB leak yields no replayable credential.
 */
export function hashAuthHash(authHash: string): Promise<string> {
  return argon2.hash(authHash, { type: argon2.argon2id });
}

export async function verifyAuthHash(storedHash: string, authHash: string): Promise<boolean> {
  try {
    return await argon2.verify(storedHash, authHash);
  } catch {
    return false;
  }
}

/** Fast one-way hash for high-entropy tokens/OTPs (not passwords). */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/** URL-safe opaque token (refresh tokens, email-verify tokens). */
export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Numeric OTP, zero-padded to `digits` length. */
export function generateNumericOtp(digits = 6): string {
  const max = 10 ** digits;
  return randomInt(0, max).toString().padStart(digits, '0');
}
