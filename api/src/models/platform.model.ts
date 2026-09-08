import { Schema, model, type Types } from 'mongoose';

export interface BackupCodeSubdoc {
  encrypted_code: string;
  is_used: boolean;
  used_at?: Date;
}

export interface PlatformDoc {
  org_id: Types.ObjectId;
  created_by: Types.ObjectId;
  project_id?: Types.ObjectId;
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
    org_id: { type: Schema.Types.ObjectId, ref: 'Org', required: true, index: true },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    project_id: { type: Schema.Types.ObjectId, ref: 'Project', index: true },
    name: { type: String, required: true, trim: true },
    note: { type: String, trim: true },
    backup_codes: { type: [backupCodeSchema], default: [] },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

platformSchema.index({ org_id: 1, created_at: -1 });

export const Platform = model<PlatformDoc>('Platform', platformSchema);
