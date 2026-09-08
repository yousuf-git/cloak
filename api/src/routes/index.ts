import { Router } from 'express';
import { config } from '../config/index.js';
import { NotFoundError } from '../lib/errors.js';
import { authRouter, meRouter } from './auth.routes.js';
import { statusRouter } from './health.routes.js';
import { vaultRouter } from './vault.routes.js';
import { orgRouter, invitationRouter } from './org.routes.js';

/** Versioned API router. */
export const apiV1Router = Router();

apiV1Router.get('/', (_req, res) => {
  res.json({ data: { name: 'cloak-api', version: 'v1' } });
});

apiV1Router.use('/auth', authRouter);
apiV1Router.use('/status', statusRouter);
apiV1Router.use('/me', meRouter);
apiV1Router.use('/vault', vaultRouter);
apiV1Router.use('/orgs', orgRouter);
apiV1Router.use('/invitations', invitationRouter);

// Dev-only sanity route to confirm the global error envelope works.
if (!config.isProd) {
  apiV1Router.get('/_error-demo', () => {
    throw new NotFoundError('Demo');
  });
}
