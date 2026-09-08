import { Router } from 'express';
import { asyncHandler, ok } from '../lib/http.js';
import { dbStatus, pingDb } from '../lib/db.js';
import { ServiceUnavailableError } from '../lib/errors.js';
import { requireAuth } from '../middlewares/require-auth.js';

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

/**
 * Detailed status for the desktop dashboard. Authenticated on purpose: the
 * database name is deployment detail and has no place on a public probe.
 */
export const statusRouter = Router();
statusRouter.use(requireAuth);
statusRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    ok(res, { api: { ok: true }, db: await dbStatus() });
  }),
);
