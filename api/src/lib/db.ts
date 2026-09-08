import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { logger } from './logger.js';

mongoose.set('strictQuery', true);

export async function connectDb(): Promise<void> {
  await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  logger.info('MongoDB connected');
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}

export interface DbStatus {
  connected: boolean;
  /** Null only when there is no connection to read the name from. */
  name: string | null;
}

/** Connection state plus the database name, for the desktop's status panel. */
export async function dbStatus(): Promise<DbStatus> {
  const conn = mongoose.connection;
  if (conn.readyState !== 1 || !conn.db) return { connected: false, name: null };
  try {
    await conn.db.admin().ping();
    return { connected: true, name: conn.db.databaseName };
  } catch {
    return { connected: false, name: conn.db.databaseName };
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
