import { Schema, model, type Types } from 'mongoose';
import { ROLES, type Role } from './membership.model.js';

export type InvitationStatus = 'pending' | 'accepted' | 'revoked';

export interface InvitationDoc {
  org_id: Types.ObjectId;
  email: string;
  role: Role;
  // Only a hash of the emailed token is stored, as with refresh tokens.
  token_hash: string;
  invited_by: Types.ObjectId;
  accepted_by?: Types.ObjectId;
  status: InvitationStatus;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

/** Pending invitations. Expired rows auto-purge via a TTL index. */
const invitationSchema = new Schema<InvitationDoc>(
  {
    org_id: { type: Schema.Types.ObjectId, ref: 'Org', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    role: { type: String, enum: ROLES, required: true },
    token_hash: { type: String, required: true, unique: true },
    invited_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    accepted_by: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'accepted', 'revoked'], required: true, default: 'pending' },
    expires_at: { type: Date, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

invitationSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export const Invitation = model<InvitationDoc>('Invitation', invitationSchema);
