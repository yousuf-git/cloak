import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { logger } from './logger.js';

mongoose.set('strictQuery', true);

/**
 * Startup connection policy. Bounded, so a database that is gone for good ends
 * in a clear failure instead of a process that never listens; exponential, so
 * a blip — a Wi-Fi reconnect, Mongo still booting in the next container — is
 * ridden out without hammering it. Worst case is about a minute.
 *
 * Only the first connection needs this: once connected, the driver reconnects
 * on its own.
 */
const CONNECT_ATTEMPTS = 5;
const FIRST_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 8_000;

/**
 * A ceiling on each attempt, not just its server selection. For a
 * `mongodb+srv://` URI the driver first resolves DNS SRV records, which
 * `serverSelectionTimeoutMS` does not cover — a network drop there hung startup
 * silently until the desktop app gave up waiting.
 */
const ATTEMPT_DEADLINE_MS = 12_000;

export interface ConnectOptions {
  /** Called before each retry; the desktop app shows this progress. */
  onRetry?: (next: { attempt: number; maxAttempts: number; error: Error }) => void;
  attempts?: number;
  deadlineMs?: number;
  firstBackoffMs?: number;
}

/** Wait after the `failures`-th failed attempt: 1s, 2s, 4s, 8s, then capped. */
export function connectBackoffMs(failures: number, firstBackoffMs = FIRST_BACKOFF_MS): number {
  return Math.min(firstBackoffMs * 2 ** (failures - 1), MAX_BACKOFF_MS);
}

async function connectOnce(deadlineMs: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(
            `No answer from the database within ${deadlineMs / 1000}s — ` +
              'the network is down or the address in MONGODB_URI cannot be resolved',
          ),
        ),
      deadlineMs,
    );
  });
  try {
    await Promise.race([
      mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 5000 }),
      deadline,
    ]);
  } catch (err) {
    // An attempt abandoned at the deadline is still pending inside the driver;
    // the next connect() would trip over it.
    await mongoose.disconnect().catch(() => {});
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function connectDb(options: ConnectOptions = {}): Promise<void> {
  const attempts = options.attempts ?? CONNECT_ATTEMPTS;
  const deadlineMs = options.deadlineMs ?? ATTEMPT_DEADLINE_MS;

  for (let attempt = 1; ; attempt++) {
    try {
      await connectOnce(deadlineMs);
      logger.info('MongoDB connected');
      return;
    } catch (err) {
      if (attempt >= attempts) throw err;
      const error = err instanceof Error ? err : new Error(String(err));
      const retryInMs = connectBackoffMs(attempt, options.firstBackoffMs);
      logger.warn(
        { err: error, attempt, maxAttempts: attempts, retryInMs },
        'Database connection failed — retrying',
      );
      options.onRetry?.({ attempt: attempt + 1, maxAttempts: attempts, error });
      await new Promise((resolve) => setTimeout(resolve, retryInMs));
    }
  }
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}

export interface DbStatus {
  connected: boolean;
  /** Null only when there is no connection to read the name from. */
  name: string | null;
  /** Which server the data is on: an Atlas cluster address, or host:port. */
  cluster: string | null;
}

/**
 * The host from a MongoDB connection string, credentials stripped.
 *
 * Parsed rather than read off the live connection because it has to answer
 * while the database is down, which is when an operator most wants to know
 * which server was being dialled. A replica set lists several hosts; the first
 * identifies the deployment well enough for a status card.
 */
export function clusterFromUri(uri: string): string | null {
  const withoutScheme = uri.replace(/^mongodb(\+srv)?:\/\//i, '');
  if (withoutScheme === uri) return null;
  const authority = withoutScheme.slice(withoutScheme.indexOf('@') + 1).split(/[/?]/)[0] ?? '';
  const [host, ...rest] = authority.split(',');
  if (!host) return null;
  return rest.length > 0 ? `${host} +${rest.length}` : host;
}

/** Connection state plus the database name, for the desktop's status panel. */
export async function dbStatus(): Promise<DbStatus> {
  const cluster = clusterFromUri(config.MONGODB_URI);
  const conn = mongoose.connection;
  if (conn.readyState !== 1 || !conn.db) return { connected: false, name: null, cluster };
  try {
    await conn.db.admin().ping();
    return { connected: true, name: conn.db.databaseName, cluster };
  } catch {
    return { connected: false, name: conn.db.databaseName, cluster };
  }
}

/** Used by the /ready readiness probe. Throws if the DB is unreachable. */
export async function pingDb(): Promise<void> {
  const conn = mongoose.connection;
  if (conn.readyState !== 1 || !conn.db) {
    throw new Error('database not connected');
  }
  await conn.db.admin().ping();
}
