import { Schema, model, type Types } from 'mongoose';

export interface ProjectDoc {
  org_id: Types.ObjectId;
  name: string;
  url?: string;
  note?: string;
  created_by: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

/** Grouping for vault resources. Owned by an org, never by a single member. */
const projectSchema = new Schema<ProjectDoc>(
  {
    org_id: { type: Schema.Types.ObjectId, ref: 'Org', required: true, index: true },
    name: { type: String, required: true, trim: true },
    url: { type: String, trim: true },
    note: { type: String, trim: true },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

export const Project = model<ProjectDoc>('Project', projectSchema);
