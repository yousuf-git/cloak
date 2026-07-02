import { Router } from 'express';
import { asyncHandler, ok } from '../lib/http.js';
import { pingDb } from '../lib/db.js';
import { ServiceUnavailableError } from '../lib/errors.js';

export const healthRouter = Router();

// Liveness: the process is up.
healthRouter.get('/health', (_req, res) => {
  ok(res, { status: 'ok' });
});

// Readiness: dependencies (Mongo) are reachable.
healthRouter.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    try {
      await pingDb();
    } catch {
      throw new ServiceUnavailableError('Database not ready');
    }
    ok(res, { status: 'ready' });
  }),
);
