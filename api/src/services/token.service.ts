import type { Types } from 'mongoose';
import { RefreshToken } from '../models/refresh-token.model.js';
import { User } from '../models/user.model.js';
import { signAccessToken } from '../lib/jwt.js';
import { generateOpaqueToken, sha256 } from '../lib/hashing.js';
import { config } from '../config/index.js';
import { parseDurationMs, futureDate } from '../utils/duration.js';
import { UnauthorizedError } from '../lib/errors.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const refreshTtlMs = parseDurationMs(config.REFRESH_TOKEN_TTL);

/** Issue a fresh access + refresh token pair and persist the refresh token hash. */
export async function issueTokenPair(userId: Types.ObjectId, email: string): Promise<TokenPair> {
  const accessToken = signAccessToken({ sub: userId.toString(), email });
  const refreshToken = generateOpaqueToken();

  await RefreshToken.create({
    user_id: userId,
    token_hash: sha256(refreshToken),
    expires_at: futureDate(refreshTtlMs),
  });

  return { accessToken, refreshToken };
}

/**
 * Rotate a refresh token: verify it is active, revoke it, and issue a new pair.
 * Rejects revoked/expired/unknown tokens.
 */
export async function rotateRefreshToken(rawToken: string): Promise<TokenPair & { userId: string }> {
  const tokenHash = sha256(rawToken);
  const existing = await RefreshToken.findOne({ token_hash: tokenHash });

  if (!existing || existing.revoked_at || existing.expires_at.getTime() < Date.now()) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const user = await User.findById(existing.user_id);
  if (!user) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  existing.revoked_at = new Date();
  await existing.save();

  const pair = await issueTokenPair(user._id as Types.ObjectId, user.email);
  return { ...pair, userId: user._id.toString() };
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  await RefreshToken.updateOne(
    { token_hash: sha256(rawToken) },
    { $set: { revoked_at: new Date() } },
  );
}

export async function revokeAllForUser(userId: Types.ObjectId): Promise<void> {
  await RefreshToken.updateMany(
    { user_id: userId, revoked_at: { $exists: false } },
    { $set: { revoked_at: new Date() } },
  );
}
