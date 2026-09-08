import { Schema, model, type Types } from 'mongoose';

export const ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export type MembershipStatus = 'pending_key' | 'active';

export interface MembershipDoc {
  org_id: Types.ObjectId;
  user_id: Types.ObjectId;
  role: Role;
  status: MembershipStatus;
  // Org DEK sealed to this member's identity public key. Absent until an
  // existing member grants access — the server cannot produce it.
  wrapped_org_dek?: string | null;
  invited_by?: Types.ObjectId;
  // Who sealed the Org DEK to this member. Recorded for the member's detail
  // view — the grant is the moment they actually gained read access.
  granted_by?: Types.ObjectId;
  // The three moments of a join, kept apart because they are genuinely
  // different events: the invitation was sent, they accepted it, and someone
  // finally sealed the key to them. Copied off the invitation at accept time,
  // since that document is removed by its own TTL once it expires.
  invited_at?: Date;
  joined_at?: Date;
  granted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const membershipSchema = new Schema<MembershipDoc>(
  {
    org_id: { type: Schema.Types.ObjectId, ref: 'Org', required: true, index: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ROLES, required: true },
    status: { type: String, enum: ['pending_key', 'active'], required: true, default: 'pending_key' },
    wrapped_org_dek: { type: String, default: null },
    invited_by: { type: Schema.Types.ObjectId, ref: 'User' },
    granted_by: { type: Schema.Types.ObjectId, ref: 'User' },
    invited_at: { type: Date },
    joined_at: { type: Date },
    granted_at: { type: Date },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

membershipSchema.index({ org_id: 1, user_id: 1 }, { unique: true });

export const Membership = model<MembershipDoc>('Membership', membershipSchema);
