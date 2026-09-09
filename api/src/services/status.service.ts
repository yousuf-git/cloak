import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { dbStatus } from '../lib/db.js';
import { API_CONTRACT, MIN_CLIENT_VERSION, SERVER_VERSION } from '../lib/version.js';
import { User } from '../models/user.model.js';
import { Org } from '../models/org.model.js';
import { Membership } from '../models/membership.model.js';
import { deploymentState } from './deployment.service.js';

/**
 * The unauthenticated half. Everything here is either already implied by the
 * server answering at all, or is something the desktop client cannot connect
 * without. Notably absent: the database name, the mail sender, and every count.
 */
export interface ServerInfo {
  name: string;
  server_version: string;
  api_contract: number;
  min_client_version: string;
  ownership_claimed: boolean;
  /** Whether each dependency is usable. Booleans only — no hostnames, no names. */
  checks: {
    database: boolean;
    email: boolean;
  };
  /** True when the operator has not set PUBLIC_URL, so join keys would be wrong. */
  public_url_unset: boolean;
}

export async function serverInfo(): Promise<ServerInfo> {
  const [db, deployment] = await Promise.all([dbStatus(), deploymentState()]);
  return {
    name: config.SERVER_NAME,
    server_version: SERVER_VERSION,
    api_contract: API_CONTRACT,
    min_client_version: MIN_CLIENT_VERSION,
    ownership_claimed: deployment.claimed,
    checks: { database: db.connected, email: config.mailConfigured },
    public_url_unset: !config.publicUrlConfigured,
  };
}

/** Shows enough of a secret to match it against a dashboard, never enough to use. */
function mask(secret: string | undefined): string | null {
  if (!secret) return null;
  if (secret.length <= 10) return `${secret.slice(0, 2)}${'*'.repeat(6)}`;
  return `${secret.slice(0, 6)}${'*'.repeat(8)}${secret.slice(-4)}`;
}

export interface ServerStatus extends ServerInfo {
  uptime_seconds: number;
  started_at: string;
  node_version: string;
  platform: string;
  memory_mb: { rss: number; heap_used: number };
  database: {
    connected: boolean;
    name: string | null;
    /** Mongoose readyState as a word, so a stuck 'connecting' is visible. */
    state: string;
  };
  email: {
    configured: boolean;
    api_key_masked: string | null;
    from: string | null;
  };
  deployment: {
    claimed: boolean;
    key_fingerprint?: string;
    sealed_at: string | null;
    claimed_at: string | null;
  };
  public_url: string;
  counts: { users: number; organizations: number; memberships: number };
}

const READY_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

/** The operator's view. Gated behind HEALTH_TOKEN or an authenticated session. */
export async function serverStatus(): Promise<ServerStatus> {
  const info = await serverInfo();
  const [db, deployment] = await Promise.all([dbStatus(), deploymentState()]);

  // Counts only mean anything once Mongo is up; asking a dead connection just
  // stalls the page for the full server-selection timeout.
  const [users, organizations, memberships] = db.connected
    ? await Promise.all([
        User.estimatedDocumentCount(),
        Org.estimatedDocumentCount(),
        Membership.estimatedDocumentCount(),
      ])
    : [0, 0, 0];

  const mem = process.memoryUsage();
  const uptime = process.uptime();

  return {
    ...info,
    uptime_seconds: Math.floor(uptime),
    started_at: new Date(Date.now() - uptime * 1000).toISOString(),
    node_version: process.version,
    platform: `${process.platform} ${process.arch}`,
    memory_mb: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heap_used: Math.round(mem.heapUsed / 1024 / 1024),
    },
    database: {
      connected: db.connected,
      name: db.name,
      state: READY_STATES[mongoose.connection.readyState] ?? 'unknown',
    },
    email: {
      configured: config.mailConfigured,
      api_key_masked: mask(config.RESEND_API_KEY),
      from: config.RESEND_FROM_EMAIL ?? null,
    },
    deployment: {
      claimed: deployment.claimed,
      key_fingerprint: deployment.key_fingerprint,
      sealed_at: deployment.sealed_at?.toISOString() ?? null,
      claimed_at: deployment.claimed_at?.toISOString() ?? null,
    },
    public_url: config.publicUrl,
    counts: { users, organizations, memberships },
  };
}
