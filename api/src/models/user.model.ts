import { Schema, model, type Types } from 'mongoose';

export interface ProjectSubdoc {
  name: string;
  url?: string;
  note?: string;
}

export interface UserDoc {
  email: string;
  is_verified: boolean;
  verified_at?: Date;
  password_hash: string;
  crypto_salt: string;
  wrappedDEK: string;
  // DEK wrapped by a key derived from the one-time recovery key (recovery envelope).
  recovery_wrappedDEK: string;
  two_factor_enabled: boolean;
  last_login_at?: Date;
  projects: Types.DocumentArray<ProjectSubdoc>;
  created_at: Date;
  updated_at: Date;
}

const projectSchema = new Schema<ProjectSubdoc>(
  {
    name: { type: String, required: true, trim: true },
    url: { type: String, trim: true },
    note: { type: String, trim: true },
  },
  { _id: true, timestamps: true },
);

const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
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

    two_factor_enabled: { type: Boolean, default: false },
    last_login_at: { type: Date },

    projects: { type: [projectSchema], default: [] },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

export const User = model<UserDoc>('User', userSchema);
