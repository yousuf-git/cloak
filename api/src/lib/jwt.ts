import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface AccessTokenClaims {
  sub: string;
  email: string;
}

export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(claims, config.JWT_SECRET, {
    expiresIn: config.ACCESS_TOKEN_TTL as SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  return jwt.verify(token, config.JWT_SECRET) as AccessTokenClaims;
}

interface RecoveryClaims {
  email: string;
  purpose: 'recovery';
}

/** Short-lived token proving the user completed the recovery email challenge. */
export function signRecoveryToken(email: string): string {
  return jwt.sign({ email, purpose: 'recovery' } satisfies RecoveryClaims, config.JWT_SECRET, {
    expiresIn: '10m',
  });
}

export function verifyRecoveryToken(token: string): string {
  const claims = jwt.verify(token, config.JWT_SECRET) as RecoveryClaims;
  if (claims.purpose !== 'recovery') {
    throw new Error('Invalid recovery token');
  }
  return claims.email;
}
