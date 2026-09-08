import { Schema, model, type Types } from 'mongoose';

export interface ApiKeyDoc {
  org_id: Types.ObjectId;
  created_by: Types.ObjectId;
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
    org_id: { type: Schema.Types.ObjectId, ref: 'Org', required: true, index: true },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', index: true },
    label: { type: String, required: true, trim: true },
    url: { type: String, trim: true },
    key: { type: String, required: true },
    note: { type: String, trim: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

apiKeySchema.index({ org_id: 1, created_at: -1 });

export const ApiKey = model<ApiKeyDoc>('ApiKey', apiKeySchema);
