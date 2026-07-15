import type { Server } from 'node:http';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { connectDb, disconnectDb } from './lib/db.js';
import { logger } from './lib/logger.js';

async function main(): Promise<void> {
  await connectDb();

  const app = createApp();
  const server: Server = app.listen(config.PORT, () => {
    logger.info(`cloak-api listening on :${config.PORT} (${config.NODE_ENV})`);
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
  process.exit(1);
});
