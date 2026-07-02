import { Schema, model, type Types } from 'mongoose';

export interface AuditLogDoc {
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
    user_id: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    action: { type: String, required: true },
    resource: { type: String },
    resource_id: { type: String },
    ip: { type: String },
    user_agent: { type: String },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
);

export const AuditLog = model<AuditLogDoc>('AuditLog', auditLogSchema);
