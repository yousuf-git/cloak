import { RefreshToken } from '../models/refresh-token.model.js';
import { config } from '../config/index.js';
import { parseDurationMs } from '../utils/duration.js';
import { logger } from './logger.js';

/**
 * Bring rows written by an older server up to the shape the current models
 * expect. Runs at startup, before the port opens; every step matches only rows
 * still in the old shape, so running it again is a no-op.
 */
export async function runUpgrades(): Promise<void> {
  await giveLegacyTokensASession();
}

/**
 * Refresh tokens issued before v0.3.0 have no session. Rotating one would fail
 * on the missing fields and sign that device out with a server error.
 *
 * Each becomes a session of its own, reusing its row id: the id is unique and
 * already an ObjectId, and a device that has been rotating since then only
 * holds the newest token of its chain anyway. The session is taken to have
 * started when the token was issued, which caps it no later than a fresh
 * sign-in at that moment would have been.
 */
async function giveLegacyTokensASession(): Promise<void> {
  const maxTtlMs = parseDurationMs(config.SESSION_MAX_TTL);
  const result = await RefreshToken.collection.updateMany({ session_id: { $exists: false } }, [
    {
      $set: {
        session_id: '$_id',
        session_started_at: { $ifNull: ['$created_at', '$$NOW'] },
        session_expires_at: { $add: [{ $ifNull: ['$created_at', '$$NOW'] }, maxTtlMs] },
      },
    },
  ]);
  if (result.modifiedCount > 0) {
    logger.info(
      `upgrade: gave ${result.modifiedCount} refresh token(s) from before sessions a session`,
    );
  }
}
