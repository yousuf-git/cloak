import { Schema, model, type Types } from 'mongoose';

export interface RefreshTokenDoc {
  user_id: Types.ObjectId;
  token_hash: string;
  revoked_at?: Date;
  expires_at: Date;
  created_at: Date;
}

/**
 * Rotating refresh tokens. Only a hash of the token is stored. Expired tokens
 * auto-purge via a TTL index; rotation revokes the previous token.
 */
const refreshTokenSchema = new Schema<RefreshTokenDoc>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token_hash: { type: String, required: true, unique: true },
    revoked_at: { type: Date },
    expires_at: { type: Date, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
);

refreshTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model<RefreshTokenDoc>('RefreshToken', refreshTokenSchema);
