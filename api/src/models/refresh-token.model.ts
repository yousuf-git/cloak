import { Schema, model, type Types } from 'mongoose';

/** Why a token stopped being usable. Kept for the audit trail and support. */
export type RevokedReason =
  | 'rotated'
  | 'logout'
  | 'revoked'
  | 'reuse_detected'
  | 'session_expired'
  | 'password_reset';

export interface RefreshTokenDoc {
  user_id: Types.ObjectId;
  /**
   * Stable across rotation: every token minted from one sign-in shares it, so a
   * session can be listed and revoked as one thing rather than as a chain.
   */
  session_id: Types.ObjectId;
  token_hash: string;
  /** When the sign-in that started this session happened, carried forward. */
  session_started_at: Date;
  /** Hard ceiling on the session. Rotation cannot push past it. */
  session_expires_at: Date;
  revoked_at?: Date;
  revoked_reason?: RevokedReason;
  /** Where the session was last seen from. Refreshed on every rotation. */
  ip?: string;
  user_agent?: string;
  expires_at: Date;
  created_at: Date;
}

/**
 * Rotating refresh tokens. Only a hash of the token is stored. Expired tokens
 * auto-purge via a TTL index; rotation revokes the previous token but keeps the
 * row, because replaying a revoked token is how token theft announces itself.
 */
const refreshTokenSchema = new Schema<RefreshTokenDoc>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    session_id: { type: Schema.Types.ObjectId, required: true },
    token_hash: { type: String, required: true, unique: true },
    session_started_at: { type: Date, required: true },
    session_expires_at: { type: Date, required: true },
    revoked_at: { type: Date },
    revoked_reason: { type: String },
    ip: { type: String },
    user_agent: { type: String },
    expires_at: { type: Date, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
);

// Backs both the session list and family-wide revocation.
refreshTokenSchema.index({ user_id: 1, session_id: 1 });
refreshTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model<RefreshTokenDoc>('RefreshToken', refreshTokenSchema);
