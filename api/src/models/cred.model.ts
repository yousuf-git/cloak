import { Schema, model, type Types } from 'mongoose';

export interface CredDoc {
  user_id: Types.ObjectId;
  project_id?: Types.ObjectId;
  name: string;
  url?: string;
  // Plaintext — searchable metadata, not a secret.
  username: string;
  // Ciphertext (XChaCha20-Poly1305, client-side). Opaque to the server.
  password: string;
  note?: string;
  created_at: Date;
  updated_at: Date;
}

const credSchema = new Schema<CredDoc>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    project_id: { type: Schema.Types.ObjectId, index: true },
    name: { type: String, required: true, trim: true },
    url: { type: String, trim: true },
    username: { type: String, required: true },
    password: { type: String, required: true },
    note: { type: String, trim: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

export const Cred = model<CredDoc>('Cred', credSchema);
