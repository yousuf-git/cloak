import { Schema, model, type Types } from 'mongoose';

export interface OrgDoc {
  name: string;
  owner_id: Types.ObjectId;
  // Public KDF salt for the org recovery key. Not a secret.
  org_recovery_salt: string;
  // Org DEK wrapped by a key derived from the one-time org recovery key.
  // Opaque to the server — the break-glass envelope.
  org_recovery_wrappedDEK: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * An organization owns every vault resource. Every account has at least one —
 * a solo user's default "Personal Space" is an org with a single member.
 * The Org DEK itself is never stored here in any usable form.
 */
const orgSchema = new Schema<OrgDoc>(
  {
    name: { type: String, required: true, trim: true },
    owner_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    org_recovery_salt: { type: String, required: true },
    org_recovery_wrappedDEK: { type: String, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

export const Org = model<OrgDoc>('Org', orgSchema);
