import { Schema, model, type Types } from 'mongoose';

export type EnvTag = 'Local' | 'Staging' | 'Production' | 'Custom';

export interface EnvFileDoc {
  user_id: Types.ObjectId;
  project_id: Types.ObjectId;
  label: string;
  tag: EnvTag;
  // dotenvx private key wrapped by the client's Vault DEK. Null when the user
  // imported a pre-encrypted file without supplying the key (view-only).
  encrypted_dotenvx_key?: string | null;
  // The dotenvx-encrypted .env document (values encrypted client-side; comments
  // and keys preserved verbatim). Opaque secret payload — stored, never logged.
  content: string;
  variable_count: number;
  created_at: Date;
  updated_at: Date;
}

const envFileSchema = new Schema<EnvFileDoc>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    project_id: { type: Schema.Types.ObjectId, required: true, index: true },
    label: { type: String, required: true, trim: true },
    tag: { type: String, enum: ['Local', 'Staging', 'Production', 'Custom'], default: 'Local' },
    encrypted_dotenvx_key: { type: String, default: null },
    content: { type: String, required: true },
    variable_count: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

export const EnvFile = model<EnvFileDoc>('EnvFile', envFileSchema);
