import { Schema, model } from 'mongoose';

export interface UserDoc {
  email: string;
  name?: string;
  is_verified: boolean;
  verified_at?: Date;
  password_hash: string;
  crypto_salt: string;
  wrappedDEK: string;
  // DEK wrapped by a key derived from the one-time recovery key (recovery envelope).
  recovery_wrappedDEK: string;
  // X25519 public key other members seal Org DEKs to. Public by design.
  identity_public_key?: string;
  // Matching secret key, wrapped by this user's own DEK. Opaque to the server.
  wrapped_identity_sk?: string;
  two_factor_enabled: boolean;
  last_login_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, trim: true, maxlength: 80 },
    is_verified: { type: Boolean, default: false },
    verified_at: { type: Date },

    // Server-side hash of the client-provided authHash (never the raw password).
    password_hash: { type: String, required: true },
    // Public salt for the client-side Master Key KDF.
    crypto_salt: { type: String, required: true },
    // Vault DEK wrapped by the client's Master Key. Opaque to the server.
    wrappedDEK: { type: String, required: true },
    // Vault DEK wrapped by the recovery key. Opaque to the server.
    recovery_wrappedDEK: { type: String, required: true },

    identity_public_key: { type: String },
    wrapped_identity_sk: { type: String },

    two_factor_enabled: { type: Boolean, default: false },
    last_login_at: { type: Date },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

export const User = model<UserDoc>('User', userSchema);
