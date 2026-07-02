import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { UnauthorizedError } from '../lib/errors.js';

interface AccessTokenPayload {
  sub: string;
  email: string;
}

/**
 * JWT guard. Apply to protected routers only (public routes are simply not
 * mounted behind it) — no substring allowlists.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Access denied. No token provided.');
  }
  try {
    const payload = jwt.verify(header.slice(7), config.JWT_SECRET) as AccessTokenPayload;
    req.user = { sub: payload.sub, email: payload.email };
    next();
  } catch {
    throw new UnauthorizedError('Invalid or expired token.');
  }
}
