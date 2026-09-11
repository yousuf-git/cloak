import type { Request } from 'express';
import { Types } from 'mongoose';
import { RefreshToken, type RevokedReason } from '../models/refresh-token.model.js';
import { User } from '../models/user.model.js';
import { signAccessToken } from '../lib/jwt.js';
import { generateOpaqueToken, sha256 } from '../lib/hashing.js';
import { config } from '../config/index.js';
import { parseDurationMs, futureDate } from '../utils/duration.js';
import { UnauthorizedError } from '../lib/errors.js';
import { recordAudit } from './audit.service.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** The session the pair belongs to — stable across every later rotation. */
  sessionId: string;
}

/** One live sign-in, as the account owner sees it in Settings. */
export interface SessionSummary {
  id: string;
  started_at: Date;
  last_used_at: Date;
  expires_at: Date;
  ip?: string;
  user_agent?: string;
  /** True for the session that made this request. */
  current: boolean;
}

const refreshTtlMs = parseDurationMs(config.REFRESH_TOKEN_TTL);
const sessionMaxTtlMs = parseDurationMs(config.SESSION_MAX_TTL);

function seenFrom(req?: Request): { ip?: string; user_agent?: string } {
  return { ip: req?.ip, user_agent: req?.headers['user-agent'] };
}

/** A rotated token must never outlive the session's absolute ceiling. */
function tokenExpiry(sessionExpiresAt: Date): Date {
  const sliding = futureDate(refreshTtlMs);
  return sliding < sessionExpiresAt ? sliding : sessionExpiresAt;
}

interface IssueOptions {
  req?: Request;
  /** Continue an existing session (rotation) instead of starting a new one. */
  session?: { id: Types.ObjectId; startedAt: Date; expiresAt: Date };
}

/** Issue a fresh access + refresh token pair and persist the refresh token hash. */
export async function issueTokenPair(
  userId: Types.ObjectId,
  email: string,
  options: IssueOptions = {},
): Promise<TokenPair> {
  const session = options.session ?? {
    id: new Types.ObjectId(),
    startedAt: new Date(),
    expiresAt: futureDate(sessionMaxTtlMs),
  };
  const accessToken = signAccessToken({ sub: userId.toString(), email, sid: session.id.toString() });
  const refreshToken = generateOpaqueToken();

  await RefreshToken.create({
    user_id: userId,
    session_id: session.id,
    token_hash: sha256(refreshToken),
    session_started_at: session.startedAt,
    session_expires_at: session.expiresAt,
    expires_at: tokenExpiry(session.expiresAt),
    ...seenFrom(options.req),
  });

  return { accessToken, refreshToken, sessionId: session.id.toString() };
}

/**
 * Rotate a refresh token: verify it is active, revoke it, and issue a new pair
 * inside the same session.
 *
 * A token that was already spent is not simply rejected. Rotation makes each
 * token single-use, so a second presentation means two parties hold it — the
 * whole session is revoked, and the event is audited, rather than letting the
 * thief keep rotating a chain the owner cannot see.
 */
export async function rotateRefreshToken(
  rawToken: string,
  req?: Request,
): Promise<TokenPair & { userId: string }> {
  const tokenHash = sha256(rawToken);
  const existing = await RefreshToken.findOne({ token_hash: tokenHash });

  if (!existing) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  if (existing.revoked_at) {
    await revokeSession(existing.user_id, existing.session_id, 'reuse_detected');
    await recordAudit({
      action: 'auth:refresh_reuse',
      outcome: 'failure',
      userId: existing.user_id,
      resource: 'Session',
      resourceId: existing.session_id.toString(),
      context: { revoked_reason: existing.revoked_reason ?? 'revoked' },
      req,
    });
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const now = Date.now();
  if (existing.expires_at.getTime() < now) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }
  if (existing.session_expires_at.getTime() < now) {
    await revokeSession(existing.user_id, existing.session_id, 'session_expired');
    throw new UnauthorizedError('Session expired — sign in again');
  }

  const user = await User.findById(existing.user_id);
  if (!user) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  existing.revoked_at = new Date();
  existing.revoked_reason = 'rotated';
  await existing.save();

  const pair = await issueTokenPair(user._id as Types.ObjectId, user.email, {
    req,
    session: {
      id: existing.session_id,
      startedAt: existing.session_started_at,
      expiresAt: existing.session_expires_at,
    },
  });
  return { ...pair, userId: user._id.toString() };
}

/**
 * Revoke the session a raw token belongs to. Signing out on one device ends
 * that device's session, not just the token it happens to be holding.
 */
export async function revokeRefreshToken(rawToken: string): Promise<string | null> {
  const existing = await RefreshToken.findOne({ token_hash: sha256(rawToken) });
  if (!existing) return null;
  await revokeSession(existing.user_id, existing.session_id, 'logout');
  return existing.session_id.toString();
}

/** Revoke every token in one session. Returns how many were still live. */
export async function revokeSession(
  userId: Types.ObjectId | string,
  sessionId: Types.ObjectId | string,
  reason: RevokedReason = 'revoked',
): Promise<number> {
  const result = await RefreshToken.updateMany(
    { user_id: userId, session_id: sessionId, revoked_at: { $exists: false } },
    { $set: { revoked_at: new Date(), revoked_reason: reason } },
  );
  return result.modifiedCount;
}

/** Revoke every session for a user, optionally sparing the one making the call. */
export async function revokeAllForUser(
  userId: Types.ObjectId | string,
  reason: RevokedReason = 'revoked',
  exceptSessionId?: string,
): Promise<number> {
  const filter: Record<string, unknown> = { user_id: userId, revoked_at: { $exists: false } };
  if (exceptSessionId && Types.ObjectId.isValid(exceptSessionId)) {
    filter.session_id = { $ne: new Types.ObjectId(exceptSessionId) };
  }
  const result = await RefreshToken.updateMany(filter, {
    $set: { revoked_at: new Date(), revoked_reason: reason },
  });
  return result.modifiedCount;
}

/**
 * The user's live sessions. Rotation leaves exactly one unrevoked token per
 * session, so each row here is one signed-in device.
 */
export async function listSessions(
  userId: Types.ObjectId | string,
  currentSessionId?: string,
): Promise<SessionSummary[]> {
  const rows = await RefreshToken.find({
    user_id: userId,
    revoked_at: { $exists: false },
    expires_at: { $gt: new Date() },
  })
    .sort({ created_at: -1 })
    .lean();

  return rows.map((row) => ({
    id: row.session_id.toString(),
    started_at: row.session_started_at,
    // The head token was minted by the most recent refresh, so its age is how
    // long ago this device last spoke to the server.
    last_used_at: row.created_at,
    expires_at: row.session_expires_at,
    ip: row.ip,
    user_agent: row.user_agent,
    current: currentSessionId === row.session_id.toString(),
  }));
}

/** Whether a session belongs to this user and is still live. */
export async function sessionExists(
  userId: Types.ObjectId | string,
  sessionId: string,
): Promise<boolean> {
  if (!Types.ObjectId.isValid(sessionId)) return false;
  const found = await RefreshToken.exists({
    user_id: userId,
    session_id: new Types.ObjectId(sessionId),
    revoked_at: { $exists: false },
  });
  return Boolean(found);
}
