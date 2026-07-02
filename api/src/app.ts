import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config/index.js';
import { requestLogger } from './middlewares/request-logger.js';
import { apiLimiter } from './middlewares/rate-limit.js';
import { notFoundHandler, errorHandler } from './middlewares/error-handler.js';
import { healthRouter } from './routes/health.routes.js';
import { apiV1Router } from './routes/index.js';

/**
 * Assembles the Express app WITHOUT calling listen(), so it can be imported
 * directly by Supertest. Entry point + graceful shutdown live in server.ts.
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // 1. Security headers
  app.use(helmet());

  // (Webhook raw-body routes, if ever added, go here — BEFORE express.json.)

  // 2. Body parser
  app.use(express.json({ limit: '1mb' }));

  // 3. CORS
  app.use(
    cors({
      origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN.split(','),
      credentials: true,
    }),
  );

  // 4. Request logging
  app.use(requestLogger);

  // 5. Health/readiness probes (unthrottled, no auth)
  app.use(healthRouter);

  // 6. Global rate limiting + versioned routes
  app.use('/api/', apiLimiter);
  app.use('/api/v1', apiV1Router);

  // 7. 404 then error handler (LAST)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
