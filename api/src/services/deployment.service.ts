import { randomBytes } from 'node:crypto';
import type { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import { Deployment, DEPLOYMENT_ID, type DeploymentDoc } from '../models/deployment.model.js';
import { User } from '../models/user.model.js';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import { sha256, timingSafeEqualHex } from '../lib/hashing.js';
import { SERVER_VERSION } from '../lib/version.js';
import { ConflictError, ForbiddenError, UnauthorizedError } from '../lib/errors.js';

function fingerprint(hash: string): string {
  return hash.slice(0, 8);
}

/**
 * Runs once per boot, before the server accepts traffic.
 *
 * A fresh database is sealed with the hash of OWNERSHIP_KEY. An already-sealed
 * one is left alone, except that an unclaimed deployment accepts a rotated key —
 * an operator who mistypes the key into .env should be able to fix it by editing
 * the file and restarting, not by dropping the database.
 */
export async function sealDeployment(): Promise<void> {
  const existing = await Deployment.findById(DEPLOYMENT_ID);

  if (!existing) {
    // A database with accounts in it predates this record — an existing
    // deployment upgrading, or a development database. It is already owned, so
    // seal it claimed rather than demanding a key or, worse, opening an
    // ownership flow on a server that has real users.
    if (await User.exists({})) {
      await Deployment.create({
        _id: DEPLOYMENT_ID,
        // Unmatchable by construction: there is no key, and no claim to make.
        ownership_key_hash: sha256(randomBytes(32).toString('hex')),
        ownership_key_fingerprint: 'upgraded',
        ownership_key_set_at: new Date(),
        sealed_by_version: SERVER_VERSION,
        claimed: true,
        claimed_at: new Date(),
      });
      logger.info('Existing accounts found — deployment recorded as already owned');
      return;
    }

    if (!config.OWNERSHIP_KEY) {
      throw new Error(
        'This database has no owner and OWNERSHIP_KEY is not set. Set it in .env and restart — ' +
          'without it nobody can claim this server.',
      );
    }
    const hash = sha256(config.OWNERSHIP_KEY);
    await Deployment.create({
      _id: DEPLOYMENT_ID,
      ownership_key_hash: hash,
      ownership_key_fingerprint: fingerprint(hash),
      ownership_key_set_at: new Date(),
      sealed_by_version: SERVER_VERSION,
      claimed: false,
    });
    logger.info(
      { fingerprint: fingerprint(hash) },
      'Deployment sealed. Waiting for the first owner to claim it with the ownership key.',
    );
    return;
  }

  if (existing.claimed) {
    if (config.OWNERSHIP_KEY) {
      logger.warn(
        'Ownership is already claimed — OWNERSHIP_KEY is now ignored and should be removed from .env',
      );
    }
    return;
  }

  if (!config.OWNERSHIP_KEY) {
    logger.warn(
      { fingerprint: existing.ownership_key_fingerprint },
      'Deployment is unclaimed but OWNERSHIP_KEY is not set — the key on record is still the one that works',
    );
    return;
  }

  const hash = sha256(config.OWNERSHIP_KEY);
  if (hash !== existing.ownership_key_hash) {
    existing.ownership_key_hash = hash;
    existing.ownership_key_fingerprint = fingerprint(hash);
    existing.ownership_key_set_at = new Date();
    await existing.save();
    logger.warn({ fingerprint: fingerprint(hash) }, 'Ownership key rotated from the environment');
    return;
  }

  logger.info(
    { fingerprint: existing.ownership_key_fingerprint },
    'Deployment is unclaimed. Waiting for the first owner.',
  );
}

export interface DeploymentState {
  claimed: boolean;
  /** Present only before a claim, so an operator can match it against their .env. */
  key_fingerprint?: string;
  sealed_at: Date | null;
  claimed_at: Date | null;
}

export async function deploymentState(): Promise<DeploymentState> {
  const record = await Deployment.findById(DEPLOYMENT_ID).lean<DeploymentDoc>();
  if (!record) return { claimed: false, sealed_at: null, claimed_at: null };
  return {
    claimed: record.claimed,
    key_fingerprint: record.claimed ? undefined : record.ownership_key_fingerprint,
    sealed_at: record.created_at,
    claimed_at: record.claimed_at ?? null,
  };
}

interface ClaimClaims {
  purpose: 'ownership_claim';
  fingerprint: string;
}

const CLAIM_TICKET_TTL = '15m';

/**
 * Exchange the ownership key for a short-lived ticket.
 *
 * The key is deliberately NOT spent here. Signup spends it, atomically, once the
 * owner account actually exists — otherwise a browser refresh or a failed signup
 * would leave the server permanently unclaimable.
 */
export async function claimOwnership(ownershipKey: string): Promise<string> {
  const record = await Deployment.findById(DEPLOYMENT_ID);
  if (!record) {
    throw new ForbiddenError('This server has not finished starting up');
  }
  if (record.claimed) {
    throw new ConflictError('This server already has an owner');
  }
  if (!timingSafeEqualHex(sha256(ownershipKey), record.ownership_key_hash)) {
    throw new UnauthorizedError('That ownership key is not valid for this server');
  }

  return jwt.sign(
    { purpose: 'ownership_claim', fingerprint: record.ownership_key_fingerprint } satisfies ClaimClaims,
    config.JWT_SECRET,
    { expiresIn: CLAIM_TICKET_TTL },
  );
}

/** Throws unless the ticket is a live claim ticket for the key currently on record. */
export async function verifyClaimTicket(ticket: string): Promise<void> {
  let claims: ClaimClaims;
  try {
    claims = jwt.verify(ticket, config.JWT_SECRET) as ClaimClaims;
  } catch {
    throw new UnauthorizedError('Your ownership session expired — enter the ownership key again');
  }
  if (claims.purpose !== 'ownership_claim') {
    throw new UnauthorizedError('Invalid ownership ticket');
  }

  const record = await Deployment.findById(DEPLOYMENT_ID).lean<DeploymentDoc>();
  if (!record) throw new ForbiddenError('This server has not finished starting up');
  if (record.claimed) throw new ConflictError('This server already has an owner');
  // A rotated key invalidates tickets minted against the old one.
  if (record.ownership_key_fingerprint !== claims.fingerprint) {
    throw new UnauthorizedError('The ownership key changed — enter the new one');
  }
}

/**
 * Spend the claim. Guarded on `claimed: false` so two signups racing for a fresh
 * server cannot both win; the loser's account is rolled back by the caller.
 */
export async function markClaimed(userId: Types.ObjectId | string): Promise<boolean> {
  const result = await Deployment.updateOne(
    { _id: DEPLOYMENT_ID, claimed: false },
    { $set: { claimed: true, claimed_by: userId, claimed_at: new Date() } },
  );
  return result.modifiedCount === 1;
}

/** True once any account exists, used to decide which signup gate applies. */
export async function isClaimed(): Promise<boolean> {
  const record = await Deployment.findById(DEPLOYMENT_ID).select('claimed').lean();
  return record?.claimed ?? (await User.exists({})) !== null;
}
