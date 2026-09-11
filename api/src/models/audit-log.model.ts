import { Schema, model, type Types } from 'mongoose';
import { config } from '../config/index.js';

export type AuditOutcome = 'success' | 'failure';

export interface AuditLogDoc {
  org_id?: Types.ObjectId;
  user_id?: Types.ObjectId;
  /**
   * The actor's address as it read at the time. Denormalised on purpose: the
   * trail has to stay readable after the account is renamed or deleted, and
   * failed sign-ins have an address but no user to join against.
   */
  actor_email?: string;
  action: string;
  outcome: AuditOutcome;
  resource?: string;
  resource_id?: string;
  /** What the resource was called when it was touched, e.g. ".env.production". */
  target_label?: string;
  /**
   * Small, non-secret descriptors that answer "which one, and what changed":
   * project and tag, changed field names, role transitions, counts. Never
   * values — see sanitizeContext in services/audit.service.ts.
   */
  context?: Record<string, unknown>;
  ip?: string;
  user_agent?: string;
  created_at: Date;

  /**
   * Tamper evidence. Entries form an append-only hash chain per scope: one
   * chain per organization, plus `account` for entries that belong to a person
   * rather than an org (sign-ins, session revocations).
   */
  chain_id: string;
  /** Position in the chain, from 1. Unique per chain, which is what serialises writers. */
  seq: number;
  prev_hash: string;
  hash: string;
  /** Which field set `hash` covers; see CHAIN_VERSION in lib/audit-hash.ts. */
  chain_version: number;
}

/** Sensitive-mutation audit trail. Metadata only — never secret plaintext or ciphertext. */
const auditLogSchema = new Schema<AuditLogDoc>(
  {
    org_id: { type: Schema.Types.ObjectId, ref: 'Org', index: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    actor_email: { type: String },
    action: { type: String, required: true },
    outcome: { type: String, enum: ['success', 'failure'], default: 'success' },
    resource: { type: String },
    resource_id: { type: String },
    target_label: { type: String },
    context: { type: Schema.Types.Mixed },
    ip: { type: String },
    user_agent: { type: String },
    chain_id: { type: String, required: true },
    seq: { type: Number, required: true },
    prev_hash: { type: String, required: true },
    hash: { type: String, required: true },
    chain_version: { type: Number, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
);

// Backs the per-org audit view, which pages newest-first.
auditLogSchema.index({ org_id: 1, created_at: -1 });
// Backs the account's own security log, which also has to find the entries a
// failed sign-in leaves behind — those carry an address but no user.
auditLogSchema.index({ actor_email: 1, created_at: -1 });
// Backs "everything this account did", which the account owner and support read.
auditLogSchema.index({ user_id: 1, created_at: -1 });
// Unique by construction: two writers racing for the same position collide, and
// the loser retries against the new head rather than forking the chain.
auditLogSchema.index({ chain_id: 1, seq: 1 }, { unique: true });
auditLogSchema.index(
  { created_at: 1 },
  { expireAfterSeconds: config.AUDIT_RETENTION_DAYS * 24 * 60 * 60 },
);

export const AuditLog = model<AuditLogDoc>('AuditLog', auditLogSchema);
