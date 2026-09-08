/**
 * Wipe every account and vault collection.
 *
 * Secrets are encrypted client-side, so the server cannot re-key existing rows
 * from the pre-teams single-user shape into an org. With no production data the
 * honest migration is a reset: drop everything and sign up again.
 */
import mongoose from 'mongoose';
import { config } from '../src/config/index.js';

const COLLECTIONS = [
  'users',
  'orgs',
  'memberships',
  'invitations',
  'projects',
  'creds',
  'apikeys',
  'accesskeys',
  'sshkeys',
  'platforms',
  'envfiles',
  'refreshtokens',
  'otps',
  'auditlogs',
];

async function main(): Promise<void> {
  if (config.isProd) {
    throw new Error('reset-dev-data refuses to run with NODE_ENV=production');
  }

  await mongoose.connect(config.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db;
  if (!db) throw new Error('database not connected');

  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));
  for (const name of COLLECTIONS) {
    if (!existing.has(name)) continue;
    await db.dropCollection(name);
    process.stdout.write(`dropped ${name}\n`);
  }

  await mongoose.disconnect();
  process.stdout.write('reset complete\n');
}

main().catch((err) => {
  process.stderr.write(`${String(err)}\n`);
  process.exit(1);
});
