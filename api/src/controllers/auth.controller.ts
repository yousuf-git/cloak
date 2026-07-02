import type { Request, Response } from 'express';
import { asyncHandler, created, ok } from '../lib/http.js';
import { UnauthorizedError } from '../lib/errors.js';
import * as authService from '../services/auth.service.js';
import * as tokenService from '../services/token.service.js';
import { recordAudit } from '../services/audit.service.js';

export const signup = asyncHandler(async (req: Request, res: Response) => {
  const { email, authHash, cryptoSalt, wrappedDEK, recoveryWrappedDEK } = req.body;
  await authService.signup({ email, authHash, cryptoSalt, wrappedDEK, recoveryWrappedDEK });
  await recordAudit({ action: 'auth:signup', resource: 'User', req });
  created(res, { email, verificationRequired: true });
});

export const prelogin = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.prelogin(req.body.email);
  ok(res, result);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, authHash } = req.body;
  const outcome = await authService.login(email, authHash);

  if (outcome.status === '2fa_required') {
    await recordAudit({ action: 'auth:login:2fa_challenge', resource: 'User', req });
    ok(res, { twoFactorRequired: true });
    return;
  }

  await recordAudit({
    action: 'auth:login',
    userId: outcome.userId,
    resource: 'User',
    req,
  });
  ok(res, {
    accessToken: outcome.tokens.accessToken,
    refreshToken: outcome.tokens.refreshToken,
    wrappedDEK: outcome.wrappedDEK,
  });
});

export const twoFactor = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  const result = await authService.verifyTwoFactor(email, otp);
  await recordAudit({ action: 'auth:2fa', userId: result.userId, resource: 'User', req });
  ok(res, {
    accessToken: result.tokens.accessToken,
    refreshToken: result.tokens.refreshToken,
    wrappedDEK: result.wrappedDEK,
  });
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { email, code } = req.body;
  await authService.verifyEmail(email, code);
  await recordAudit({ action: 'auth:verify_email', resource: 'User', req });
  ok(res, { verified: true });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const pair = await tokenService.rotateRefreshToken(req.body.refreshToken);
  ok(res, { accessToken: pair.accessToken, refreshToken: pair.refreshToken });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.body.refreshToken) {
    await tokenService.revokeRefreshToken(req.body.refreshToken);
  }
  await recordAudit({ action: 'auth:logout', userId: req.user?.sub, resource: 'User', req });
  ok(res, { success: true });
});

export const recoveryStart = asyncHandler(async (req: Request, res: Response) => {
  await authService.startRecovery(req.body.email);
  await recordAudit({ action: 'auth:recovery:start', resource: 'User', req });
  // Generic response — never reveal whether the account exists.
  ok(res, { sent: true });
});

export const recoveryVerify = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  const result = await authService.verifyRecovery(email, otp);
  ok(res, result);
});

export const recoveryReset = asyncHandler(async (req: Request, res: Response) => {
  const { recoveryToken, authHash, cryptoSalt, wrappedDEK, recoveryWrappedDEK } = req.body;
  const result = await authService.resetWithRecovery({
    recoveryToken,
    authHash,
    cryptoSalt,
    wrappedDEK,
    recoveryWrappedDEK,
  });
  await recordAudit({ action: 'auth:recovery:reset', userId: result.userId, resource: 'User', req });
  ok(res, {
    accessToken: result.tokens.accessToken,
    refreshToken: result.tokens.refreshToken,
    wrappedDEK: result.wrappedDEK,
  });
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const profile = await authService.getProfile(req.user.sub);
  ok(res, profile);
});

export const setTwoFactor = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const { enabled } = req.body;
  await authService.setTwoFactor(req.user.sub, enabled);
  await recordAudit({
    action: enabled ? 'auth:2fa_enabled' : 'auth:2fa_disabled',
    userId: req.user.sub,
    resource: 'User',
    req,
  });
  ok(res, { two_factor_enabled: enabled });
});
