import { writeSync } from 'node:fs';
import type { Server } from 'node:http';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { connectDb, disconnectDb } from './lib/db.js';
import { logger } from './lib/logger.js';
import { SERVER_VERSION } from './lib/version.js';
import { sealDeployment } from './services/deployment.service.js';

/** Which startup step was running, so a failure can say what broke. */
type StartupStage = 'database' | 'deployment';
let stage: StartupStage = 'database';

type StartupEvent =
  | { event: 'progress'; stage: StartupStage; attempt: number; max_attempts: number; message: string }
  | { event: 'failure'; stage: StartupStage; message: string };

/**
 * Tells the desktop app how startup is going, in a form it can parse — the log
 * lines around it are for people. Written only when running as its sidecar;
 * the prefix must match `STARTUP_PREFIX` in the Rust core.
 */
function reportStartup(event: StartupEvent): void {
  if (process.env.CLOAK_SIDECAR !== '1') return;
  // Synchronous: the failure line is followed by process.exit(), and on macOS
  // a pipe write is asynchronous and would be dropped.
  writeSync(2, `CLOAK_STARTUP ${JSON.stringify(event)}\n`);
}

async function main(): Promise<void> {
  await connectDb({
    onRetry: ({ attempt, maxAttempts, error }) =>
      reportStartup({
        event: 'progress',
        stage: 'database',
        attempt,
        max_attempts: maxAttempts,
        message: error.message,
      }),
  });
  stage = 'deployment';
  // Before the port opens: a server that cannot be claimed should never accept
  // a signup, and a claim racing the seal would have nothing to check against.
  await sealDeployment();

  const app = createApp();
  const server: Server = app.listen(config.PORT, () => {
    logger.info(`cloak-api v${SERVER_VERSION} listening on :${config.PORT} (${config.NODE_ENV})`);
    logger.info(`status page: ${config.publicUrl}/`);
    if (!config.publicUrlConfigured && config.isProd) {
      logger.warn(
        'PUBLIC_URL is not set — invitation join keys will point at localhost and no teammate will be able to connect',
      );
    }
  });

  const shutdown = (signal: string): void => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => {
      void disconnectDb().finally(() => process.exit(0));
    });
    // Force-exit safety net if connections don't drain.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Spawned by the desktop app, which holds our stdin pipe open for exactly this
  // purpose: EOF means the parent died without getting to send SIGTERM (crash,
  // SIGKILL), and an orphaned backend would keep the port and the DB connection.
  //
  // Exit hard rather than via shutdown(): that path drains live connections and
  // logs first, but our only client just died and stdout/stderr are now pipes
  // with no reader — draining and logging there hangs instead of exiting.
  if (process.env.CLOAK_SIDECAR === '1') {
    process.stdin.on('end', () => process.exit(0));
    process.stdin.resume();
  }
}

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled rejection');
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  reportStartup({ event: 'failure', stage, message: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
