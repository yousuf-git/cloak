import { Schema, model, type Types } from 'mongoose';
import { config } from '../config/index.js';

export interface AuditLogDoc {
  org_id?: Types.ObjectId;
  user_id?: Types.ObjectId;
  action: string;
  resource?: string;
  resource_id?: string;
  ip?: string;
  user_agent?: string;
  created_at: Date;
}

/** Sensitive-mutation audit trail. Metadata only — never secret plaintext or ciphertext. */
const auditLogSchema = new Schema<AuditLogDoc>(
  {
    org_id: { type: Schema.Types.ObjectId, ref: 'Org', index: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    action: { type: String, required: true },
    resource: { type: String },
    resource_id: { type: String },
    ip: { type: String },
    user_agent: { type: String },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
);

// Backs the per-org audit view, which pages newest-first.
auditLogSchema.index({ org_id: 1, created_at: -1 });
auditLogSchema.index(
  { created_at: 1 },
  { expireAfterSeconds: config.AUDIT_RETENTION_DAYS * 24 * 60 * 60 },
);

export const AuditLog = model<AuditLogDoc>('AuditLog', auditLogSchema);
