import { Schema, model, type Types } from 'mongoose';

export interface CredDoc {
  org_id: Types.ObjectId;
  created_by: Types.ObjectId;
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
    org_id: { type: Schema.Types.ObjectId, ref: 'Org', required: true, index: true },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', index: true },
    name: { type: String, required: true, trim: true },
    url: { type: String, trim: true },
    username: { type: String, required: true },
    password: { type: String, required: true },
    note: { type: String, trim: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

credSchema.index({ org_id: 1, created_at: -1 });

export const Cred = model<CredDoc>('Cred', credSchema);
