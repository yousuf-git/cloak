/**
 * Drop the entire database `MONGODB_URI` points at, for a clean start.
 *
 *   pnpm db:wipe                      # asks you to type the database name
 *   pnpm db:wipe --confirm=<db-name>  # non-interactive
 *
 * Everything goes: accounts, organizations, every vault row, sessions, the audit
 * trail, and the deployment seal — so the next server start is an unclaimed
 * server, exactly as after a fresh install. Nothing here is recoverable: vault
 * rows are ciphertext only the clients could open, so there is no export step
 * that would make a backup useful without them.
 *
 * It drops the database rather than a list of collections. A list has to be
 * kept in step with the models by hand, and falls behind the first time a
 * model is added — which is how a partial reset ends up leaving the old
 * deployment claimed.
 */
import { createConnection } from 'node:net';
import { createInterface } from 'node:readline/promises';
import mongoose from 'mongoose';
import { config } from '../src/config/index.js';

/** The port the desktop app runs its backend on (`desktop/src-tauri/src/sidecar/mod.rs`). */
const SIDECAR_PORT = 47821;

function listening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
}

/** Host only — the URI can carry a password. */
function describeTarget(uri: string): string {
  try {
    const url = new URL(uri);
    return `${url.protocol}//${url.host}`;
  } catch {
    return '(unparseable MONGODB_URI)';
  }
}

async function confirmed(dbName: string): Promise<boolean> {
  const flag = process.argv.find((arg) => arg.startsWith('--confirm='));
  if (flag) return flag.slice('--confirm='.length) === dbName;

  if (!process.stdin.isTTY) {
    process.stderr.write(`not a terminal — pass --confirm=${dbName} to wipe non-interactively\n`);
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`Type the database name (${dbName}) to wipe it: `);
  rl.close();
  return answer.trim() === dbName;
}

async function main(): Promise<void> {
  // A running backend would keep serving sessions for accounts that no longer
  // exist, and re-seal the deployment the moment it next touches the database.
  for (const port of new Set([SIDECAR_PORT, config.PORT])) {
    if (await listening(port)) {
      throw new Error(
        `something is listening on :${port} — quit Cloak and stop any running backend first`,
      );
    }
  }

  await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db;
  if (!db) throw new Error('database not connected');
  const dbName = mongoose.connection.name;

  const collections = await db.listCollections().toArray();
  process.stdout.write(`\nTarget:   ${describeTarget(config.MONGODB_URI)} / ${dbName}\n`);
  process.stdout.write(`NODE_ENV: ${config.NODE_ENV}\n\n`);
  if (collections.length === 0) {
    process.stdout.write('Database is already empty.\n');
    await mongoose.disconnect();
    return;
  }
  for (const { name } of collections.sort((a, b) => a.name.localeCompare(b.name))) {
    const count = await db.collection(name).estimatedDocumentCount();
    process.stdout.write(`  ${name.padEnd(16)} ${count}\n`);
  }
  process.stdout.write('\nThis permanently deletes all of the above. There is no undo.\n');

  if (!(await confirmed(dbName))) {
    await mongoose.disconnect();
    throw new Error('confirmation did not match — nothing was deleted');
  }

  await db.dropDatabase();
  await mongoose.disconnect();
  process.stdout.write(
    `\nWiped ${dbName}. The next server start is an unclaimed deployment: sign up again, and\n` +
      'sign in again on any device that remembered a session.\n',
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
