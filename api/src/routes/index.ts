import { Router } from 'express';
import { config } from '../config/index.js';
import { NotFoundError } from '../lib/errors.js';
import { authRouter, meRouter } from './auth.routes.js';
import { vaultRouter } from './vault.routes.js';

/**
 * Versioned API router. Feature routers (projects, env-files, creds, api-keys,
 * platforms) are mounted here in later phases.
 */
export const apiV1Router = Router();

apiV1Router.get('/', (_req, res) => {
  res.json({ data: { name: 'cloak-api', version: 'v1' } });
});

apiV1Router.use('/auth', authRouter);
apiV1Router.use('/me', meRouter);
apiV1Router.use('/vault', vaultRouter);

// Dev-only sanity route to confirm the global error envelope works.
if (!config.isProd) {
  apiV1Router.get('/_error-demo', () => {
    throw new NotFoundError('Demo');
  });
}
