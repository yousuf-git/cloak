import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import { logger } from '../lib/logger.js';

/**
 * HTTP request logging kept intentionally terse: one line per request with
 * method, URL, status and latency. We deliberately drop the full header/body
 * dumps pino-http emits by default — they're noisy and can echo sensitive data.
 */
export const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existing = req.headers['x-request-id'];
    const id = (Array.isArray(existing) ? existing[0] : existing) ?? randomUUID();
    res.setHeader('x-request-id', id);
    return id;
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, res, err) =>
    `${req.method} ${req.url} ${res.statusCode} — ${err.message}`,
  // Minimal serializers: no header/body dumps.
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
    err: (err) => ({ type: err.type, message: err.message }),
  },
});
