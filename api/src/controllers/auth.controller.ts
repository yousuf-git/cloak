import type { Request, Response } from 'express';
import { asyncHandler, created, ok } from '../lib/http.js';
import { AppError, NotFoundError, UnauthorizedError } from '../lib/errors.js';
import * as authService from '../services/auth.service.js';
import * as auditQuery from '../services/audit-query.service.js';
import * as tokenService from '../services/token.service.js';
import { recordAudit } from '../services/audit.service.js';

/** The machine-readable reason a request failed, for the audit entry. */
function failureCode(err: unknown): string {
  return err instanceof AppError ? err.code : 'INTERNAL_ERROR';
}

function requireUser(req: Request): { sub: string; email: string; sid?: string } {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

export const signup = asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = await authService.signup(req.body);
  await recordAudit({
    action: 'auth:signup',
    orgId,
    actorEmail: req.body.email,
    resource: 'User',
    targetLabel: req.body.email,
    context: { org: req.body.defaultOrg?.name },
    req,
  });
  created(res, { email: req.body.email, verificationRequired: true, orgId });
});

export const prelogin = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.prelogin(req.body.email);
  ok(res, result);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, authHash } = req.body;

  let outcome: Awaited<ReturnType<typeof authService.login>>;
  try {
    outcome = await authService.login(email, authHash, req);
  } catch (err) {
    // A failed sign-in is the entry an account owner most wants to see, so it
    // is recorded with the address that was tried and why it was refused.
    await recordAudit({
      action: 'auth:login',
      outcome: 'failure',
      actorEmail: email,
      resource: 'User',
      targetLabel: email,
      context: { reason: failureCode(err) },
      req,
    });
    throw err;
  }

  if (outcome.status === '2fa_required') {
    await recordAudit({
      action: 'auth:login:2fa_challenge',
      actorEmail: email,
      resource: 'User',
      targetLabel: email,
      req,
    });
    ok(res, { twoFactorRequired: true });
    return;
  }

  await recordAudit({
    action: 'auth:login',
    userId: outcome.userId,
    actorEmail: email,
    resource: 'Session',
    resourceId: outcome.tokens.sessionId,
    targetLabel: email,
    req,
  });
  ok(res, {
    accessToken: outcome.tokens.accessToken,
    refreshToken: outcome.tokens.refreshToken,
    wrappedDEK: outcome.wrappedDEK,
    wrappedIdentitySk: outcome.wrappedIdentitySk,
  });
});

export const twoFactor = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  let result: Awaited<ReturnType<typeof authService.verifyTwoFactor>>;
  try {
    result = await authService.verifyTwoFactor(email, otp, req);
  } catch (err) {
    await recordAudit({
      action: 'auth:2fa',
      outcome: 'failure',
      actorEmail: email,
      resource: 'User',
      targetLabel: email,
      context: { reason: failureCode(err) },
      req,
    });
    throw err;
  }

  await recordAudit({
    action: 'auth:2fa',
    userId: result.userId,
    actorEmail: email,
    resource: 'Session',
    resourceId: result.tokens.sessionId,
    targetLabel: email,
    req,
  });
  ok(res, {
    accessToken: result.tokens.accessToken,
    refreshToken: result.tokens.refreshToken,
    wrappedDEK: result.wrappedDEK,
    wrappedIdentitySk: result.wrappedIdentitySk,
  });
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { email, code } = req.body;
  try {
    await authService.verifyEmail(email, code);
  } catch (err) {
    await recordAudit({
      action: 'auth:verify_email',
      outcome: 'failure',
      actorEmail: email,
      resource: 'User',
      targetLabel: email,
      context: { reason: failureCode(err) },
      req,
    });
    throw err;
  }
  await recordAudit({
    action: 'auth:verify_email',
    actorEmail: email,
    resource: 'User',
    targetLabel: email,
    req,
  });
  ok(res, { verified: true });
});

/**
 * Rotation is deliberately not audited on success: it happens every few minutes
 * per device and would bury everything else. Reuse of a spent token is audited
 * where it is detected, in the token service.
 */
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const pair = await tokenService.rotateRefreshToken(req.body.refreshToken, req);
  ok(res, { accessToken: pair.accessToken, refreshToken: pair.refreshToken });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.body.refreshToken
    ? await tokenService.revokeRefreshToken(req.body.refreshToken)
    : null;
  await recordAudit({
    action: 'auth:logout',
    userId: req.user?.sub,
    resource: 'Session',
    resourceId: sessionId ?? undefined,
    req,
  });
  ok(res, { success: true });
});

// ---------- Sessions ----------
export const listSessions = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  ok(res, { sessions: await tokenService.listSessions(user.sub, user.sid) });
});

export const revokeSession = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const sessionId = String(req.params.sessionId);
  const revoked = await tokenService.revokeSession(user.sub, sessionId, 'revoked');
  if (revoked === 0) throw new NotFoundError('Session');

  await recordAudit({
    action: 'auth:session_revoke',
    resource: 'Session',
    resourceId: sessionId,
    context: { self: sessionId === user.sid },
    req,
  });
  ok(res, { success: true, was_current: sessionId === user.sid });
});

/**
 * Sign out everywhere else. The caller's own session survives, so using this
 * after a scare does not lock the person doing it out of the app.
 */
export const revokeOtherSessions = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const revoked = await tokenService.revokeAllForUser(user.sub, 'revoked', user.sid);
  await recordAudit({
    action: 'auth:session_revoke_all',
    resource: 'Session',
    context: { sessions_ended: revoked },
    req,
  });
  ok(res, { success: true, sessions_ended: revoked });
});

/**
 * The account's own trail, which the org audit view never shows: sign-ins are
 * not org-scoped, and a refused one has no org to scope to.
 */
export const securityLog = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const limit = Number(req.query.limit ?? 25);
  ok(res, { entries: await auditQuery.listAccountLog(user.sub, user.email, limit) });
});

export const recoveryStart = asyncHandler(async (req: Request, res: Response) => {
  await authService.startRecovery(req.body.email);
  await recordAudit({
    action: 'auth:recovery:start',
    actorEmail: req.body.email,
    resource: 'User',
    targetLabel: req.body.email,
    req,
  });
  // Generic response — never reveal whether the account exists.
  ok(res, { sent: true });
});

export const recoveryVerify = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  try {
    const result = await authService.verifyRecovery(email, otp);
    ok(res, result);
  } catch (err) {
    await recordAudit({
      action: 'auth:recovery:verify',
      outcome: 'failure',
      actorEmail: email,
      resource: 'User',
      targetLabel: email,
      context: { reason: failureCode(err) },
      req,
    });
    throw err;
  }
});

export const recoveryReset = asyncHandler(async (req: Request, res: Response) => {
  const { recoveryToken, authHash, cryptoSalt, wrappedDEK, recoveryWrappedDEK } = req.body;
  const result = await authService.resetWithRecovery(
    { recoveryToken, authHash, cryptoSalt, wrappedDEK, recoveryWrappedDEK },
    req,
  );
  await recordAudit({
    action: 'auth:recovery:reset',
    userId: result.userId,
    resource: 'Session',
    resourceId: result.tokens.sessionId,
    context: { sessions_ended: result.endedSessions },
    req,
  });
  ok(res, {
    accessToken: result.tokens.accessToken,
    refreshToken: result.tokens.refreshToken,
    wrappedDEK: result.wrappedDEK,
    wrappedIdentitySk: result.wrappedIdentitySk,
  });
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const profile = await authService.getProfile(user.sub);
  ok(res, profile);
});

export const resendVerification = asyncHandler(async (req: Request, res: Response) => {
  await authService.resendVerification(req.body.email);
  // Always the same reply: whether the address is registered, or already
  // verified, must not be observable here.
  ok(res, { sent: true });
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const profile = await authService.updateProfile(user.sub, { name: req.body.name });
  await recordAudit({
    action: 'user:rename',
    resource: 'User',
    resourceId: user.sub,
    targetLabel: profile.name ?? user.email,
    req,
  });
  ok(res, profile);
});

export const setTwoFactor = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { enabled } = req.body;
  await authService.setTwoFactor(user.sub, enabled);
  await recordAudit({
    action: enabled ? 'auth:2fa_enabled' : 'auth:2fa_disabled',
    resource: 'User',
    resourceId: user.sub,
    targetLabel: user.email,
    req,
  });
  ok(res, { two_factor_enabled: enabled });
});
