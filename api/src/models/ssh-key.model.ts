import { Schema, model, type Types } from 'mongoose';

export type SshKeyType = 'RSA' | 'ED25519';
export type SshKeyFormat = 'PEM' | 'PPK';

export interface SshKeyDoc {
  user_id: Types.ObjectId;
  project_id?: Types.ObjectId;
  title: string;
  // Detected on import from the key file's header; not user-editable.
  key_type: SshKeyType;
  format: SshKeyFormat;
  // Comment carried by PuTTY .ppk files (plaintext metadata), when present.
  comment?: string;
  // Ciphertext (XChaCha20-Poly1305, client-side) of the whole imported key file.
  private_key: string;
  note?: string;
  created_at: Date;
  updated_at: Date;
}

const sshKeySchema = new Schema<SshKeyDoc>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    project_id: { type: Schema.Types.ObjectId, index: true },
    title: { type: String, required: true, trim: true },
    key_type: { type: String, enum: ['RSA', 'ED25519'], required: true },
    format: { type: String, enum: ['PEM', 'PPK'], required: true },
    comment: { type: String, trim: true },
    private_key: { type: String, required: true },
    note: { type: String, trim: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

export const SshKey = model<SshKeyDoc>('SshKey', sshKeySchema);
