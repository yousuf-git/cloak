import type { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { config } from '../config/index.js';
import { verifyAccessToken } from '../lib/jwt.js';

const base = {
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  standardHeaders: true,
  legacyHeaders: false,
  // Disable throttling under test so integration suites aren't rate-limited.
  skip: () => config.isTest,
  message: { status: 'error', code: 'RATE_LIMITED', message: 'Too many requests, try again later.' },
};

/** The account a request is signed in as, if its access token checks out. */
function signedInAccount(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    return verifyAccessToken(header.slice(7)).sub;
  } catch {
    return null;
  }
}

/**
 * Global limiter. Signed-in traffic is budgeted per account, anonymous traffic
 * per IP.
 *
 * Every desktop screen loads several lists at once, so ordinary browsing runs
 * to a hundred-odd requests in a window — a per-IP budget sized for anonymous
 * traffic throttled real use. It also pooled everyone behind one address: every
 * account on a local backend is 127.0.0.1, and a team behind an office NAT
 * shares one IP. The token is verified, not just decoded, so a forged `sub`
 * cannot mint a fresh budget.
 */
export const apiLimiter = rateLimit({
  ...base,
  max: (req) => (signedInAccount(req) ? config.RATE_LIMIT_ACCOUNT_MAX : config.RATE_LIMIT_API_MAX),
  keyGenerator: (req) => {
    const account = signedInAccount(req);
    return account ? `account:${account}` : `ip:${ipKeyGenerator(req.ip ?? '')}`;
  },
});

/**
 * Strict brute-force limiter for secret-guessing endpoints (login, OTP, recovery
 * code). `skipSuccessfulRequests` means only FAILED attempts count toward the
 * budget, so a normal user's successful logins never trip it — only repeated
 * wrong passwords / codes do (PRD: ~N failed attempts / 15 min).
 */
export const authLimiter = rateLimit({
  ...base,
  max: config.RATE_LIMIT_AUTH_MAX,
  skipSuccessfulRequests: true,
});

/**
 * For endpoints that send mail to a caller-supplied address and answer
 * identically whatever happens. Every request counts — `authLimiter` would be
 * useless here, since its `skipSuccessfulRequests` sees a always-200 handler as
 * always successful and would never throttle anything.
 */
export const emailDispatchLimiter = rateLimit({ ...base, max: config.RATE_LIMIT_AUTH_MAX });

/** Limiter for file-upload (env-file) endpoints. */
export const uploadLimiter = rateLimit({ ...base, max: config.RATE_LIMIT_UPLOAD_MAX });
