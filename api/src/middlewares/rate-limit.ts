import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';

const base = {
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  standardHeaders: true,
  legacyHeaders: false,
  // Disable throttling under test so integration suites aren't rate-limited.
  skip: () => config.isTest,
  message: { status: 'error', code: 'RATE_LIMITED', message: 'Too many requests, try again later.' },
};

/** Looser global limiter for authenticated API traffic. */
export const apiLimiter = rateLimit({ ...base, max: config.RATE_LIMIT_API_MAX });

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

/** Limiter for file-upload (env-file) endpoints. */
export const uploadLimiter = rateLimit({ ...base, max: config.RATE_LIMIT_UPLOAD_MAX });
