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

/** Strict limiter for auth + OTP endpoints (PRD: 5 attempts / 15 min). */
export const authLimiter = rateLimit({ ...base, max: config.RATE_LIMIT_AUTH_MAX });

/** Limiter for file-upload (env-file) endpoints. */
export const uploadLimiter = rateLimit({ ...base, max: config.RATE_LIMIT_UPLOAD_MAX });
