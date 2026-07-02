import { Schema, model, type Types } from 'mongoose';

export interface ApiKeyDoc {
  user_id: Types.ObjectId;
  project_id?: Types.ObjectId;
  label: string;
  url?: string;
  // Ciphertext (XChaCha20-Poly1305, client-side). Opaque to the server.
  key: string;
  note?: string;
  created_at: Date;
  updated_at: Date;
}

const apiKeySchema = new Schema<ApiKeyDoc>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    project_id: { type: Schema.Types.ObjectId, index: true },
    label: { type: String, required: true, trim: true },
    url: { type: String, trim: true },
    key: { type: String, required: true },
    note: { type: String, trim: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

export const ApiKey = model<ApiKeyDoc>('ApiKey', apiKeySchema);
