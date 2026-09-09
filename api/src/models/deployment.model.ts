import { Schema, model, type Types } from 'mongoose';

/** There is exactly one deployment record. Its `_id` is this constant. */
export const DEPLOYMENT_ID = 'cloak-deployment';

export interface DeploymentDoc {
  _id: string;
  /** SHA-256 of the OWNERSHIP_KEY this database was sealed with. */
  ownership_key_hash: string;
  /**
   * First eight characters of the hash, safe to print. Lets an operator confirm
   * the key stored here is the one in their current .env without revealing it.
   */
  ownership_key_fingerprint: string;
  /** When the key currently on record was written. Moves on a pre-claim rotation. */
  ownership_key_set_at: Date;
  /** API build that sealed the database, for support and upgrade forensics. */
  sealed_by_version: string;
  claimed: boolean;
  claimed_by?: Types.ObjectId;
  claimed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * Proof of who is allowed to become the first owner of a self-hosted server.
 *
 * The key lives in the operator's environment and is hashed into the database
 * on first boot, so a claim has to satisfy both halves at once: possession of
 * the environment file and reach to this database. Once an owner exists the
 * record is spent and no ownership flow can run again until the database is
 * wiped and the server redeployed.
 */
const deploymentSchema = new Schema<DeploymentDoc>(
  {
    _id: { type: String, default: DEPLOYMENT_ID },
    ownership_key_hash: { type: String, required: true },
    ownership_key_fingerprint: { type: String, required: true },
    ownership_key_set_at: { type: Date, required: true },
    sealed_by_version: { type: String, required: true },
    claimed: { type: Boolean, required: true, default: false },
    claimed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    claimed_at: { type: Date },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, _id: false },
);

export const Deployment = model<DeploymentDoc>('Deployment', deploymentSchema);
