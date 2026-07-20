import { Schema, model, type Types } from 'mongoose';

export interface AccessKeyDoc {
  user_id: Types.ObjectId;
  project_id?: Types.ObjectId;
  title: string;
  // Plaintext — searchable identifier (e.g. AWS AKIA…), not itself a secret.
  access_key_id: string;
  // Ciphertext (XChaCha20-Poly1305, client-side). Opaque to the server.
  secret_access_key: string;
  note?: string;
  created_at: Date;
  updated_at: Date;
}

const accessKeySchema = new Schema<AccessKeyDoc>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    project_id: { type: Schema.Types.ObjectId, index: true },
    title: { type: String, required: true, trim: true },
    access_key_id: { type: String, required: true, trim: true },
    secret_access_key: { type: String, required: true },
    note: { type: String, trim: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

export const AccessKey = model<AccessKeyDoc>('AccessKey', accessKeySchema);
