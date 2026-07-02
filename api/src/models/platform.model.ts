import { Schema, model, type Types } from 'mongoose';

export interface BackupCodeSubdoc {
  encrypted_code: string;
  is_used: boolean;
  used_at?: Date;
}

export interface PlatformDoc {
  user_id: Types.ObjectId;
  name: string;
  note?: string;
  backup_codes: Types.DocumentArray<BackupCodeSubdoc>;
  created_at: Date;
  updated_at: Date;
}

const backupCodeSchema = new Schema<BackupCodeSubdoc>(
  {
    // Ciphertext (XChaCha20-Poly1305, client-side). Opaque to the server.
    encrypted_code: { type: String, required: true },
    is_used: { type: Boolean, default: false },
    used_at: { type: Date },
  },
  { _id: true },
);

const platformSchema = new Schema<PlatformDoc>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    note: { type: String, trim: true },
    backup_codes: { type: [backupCodeSchema], default: [] },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

export const Platform = model<PlatformDoc>('Platform', platformSchema);
