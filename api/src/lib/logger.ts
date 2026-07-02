import pino from 'pino';
import { config } from '../config/index.js';

/**
 * Structured logger. Secret-bearing keys are redacted so plaintext or
 * sensitive tokens can never leak into logs (zero-knowledge requirement).
 */
export const logger = pino({
  level: config.LOG_LEVEL,
  redact: {
    paths: [
      'password',
      'token',
      'authorization',
      'req.headers.authorization',
      'authHash',
      'wrappedDEK',
      'accessToken',
      'refreshToken',
      'otp',
      'crypto_salt',
      'encrypted_dotenvx_key',
      'content',
      'content_b64',
      'req.body.content_b64',
      'req.body.encrypted_dotenvx_key',
    ],
    censor: '[REDACTED]',
  },
  transport: config.isProd
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } },
});
