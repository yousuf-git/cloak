import { createHmac } from 'node:crypto';
import type { Types } from 'mongoose';
import { User } from '../models/user.model.js';
import { config } from '../config/index.js';
import {
  hashAuthHash,
  verifyAuthHash,
} from '../lib/hashing.js';
import { signRecoveryToken, verifyRecoveryToken } from '../lib/jwt.js';
import { ConflictError, UnauthorizedError } from '../lib/errors.js';
import { createOtp, verifyOtp, type OtpVerifyResult } from './otp.service.js';
import { sendOtpEmail, sendVerificationEmail, sendRecoveryEmail } from './email.service.js';
import { issueTokenPair, revokeAllForUser, type TokenPair } from './token.service.js';

export interface SignupInput {
  email: string;
  authHash: string;
  cryptoSalt: string;
  wrappedDEK: string;
  recoveryWrappedDEK: string;
}

export async function signup(input: SignupInput): Promise<void> {
  const existing = await User.findOne({ email: input.email });
  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await hashAuthHash(input.authHash);
  await User.create({
    email: input.email,
    password_hash: passwordHash,
    crypto_salt: input.cryptoSalt,
    wrappedDEK: input.wrappedDEK,
    recovery_wrappedDEK: input.recoveryWrappedDEK,
    is_verified: false,
  });

  const code = await createOtp(input.email, 'email_verify');
  await sendVerificationEmail(input.email, code);
}

export interface PreloginResult {
  crypto_salt: string;
  two_factor_enabled: boolean;
}

/**
 * Return the public KDF salt for a real account, or a deterministic fake salt
 * for unknown emails so account existence is not leaked (enumeration defense).
 */
export async function prelogin(email: string): Promise<PreloginResult> {
  const user = await User.findOne({ email });
  if (user) {
    return { crypto_salt: user.crypto_salt, two_factor_enabled: user.two_factor_enabled };
  }
  return { crypto_salt: deterministicFakeSalt(email), two_factor_enabled: false };
}

function deterministicFakeSalt(email: string): string {
  return createHmac('sha256', config.JWT_SECRET)
    .update(`fake-salt:${email}`)
    .digest('base64')
    .slice(0, 24);
}

export type LoginOutcome =
  | { status: 'tokens'; tokens: TokenPair; wrappedDEK: string; userId: Types.ObjectId }
  | { status: '2fa_required' };

export async function login(email: string, authHash: string): Promise<LoginOutcome> {
  const user = await User.findOne({ email });
  // Constant-ish work even on unknown users: verify against a decoy is skipped
  // for simplicity, but we always return the same generic error below.
  if (!user || !(await verifyAuthHash(user.password_hash, authHash))) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (user.two_factor_enabled) {
    const code = await createOtp(email, 'login_2fa');
    await sendOtpEmail(email, code);
    return { status: '2fa_required' };
  }

  const tokens = await issueTokenPair(user._id as Types.ObjectId, user.email);
  user.last_login_at = new Date();
  await user.save();
  return { status: 'tokens', tokens, wrappedDEK: user.wrappedDEK, userId: user._id as Types.ObjectId };
}

export interface TwoFactorResult {
  tokens: TokenPair;
  wrappedDEK: string;
  userId: Types.ObjectId;
}

export async function verifyTwoFactor(email: string, code: string): Promise<TwoFactorResult> {
  const result = await verifyOtp(email, 'login_2fa', code);
  throwOnOtpFailure(result);

  const user = await User.findOne({ email });
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const tokens = await issueTokenPair(user._id as Types.ObjectId, user.email);
  user.last_login_at = new Date();
  await user.save();
  return { tokens, wrappedDEK: user.wrappedDEK, userId: user._id as Types.ObjectId };
}

export async function verifyEmail(email: string, code: string): Promise<void> {
  const result = await verifyOtp(email, 'email_verify', code);
  throwOnOtpFailure(result);

  await User.updateOne(
    { email },
    { $set: { is_verified: true, verified_at: new Date() } },
  );
}

export async function setTwoFactor(userId: Types.ObjectId | string, enabled: boolean): Promise<void> {
  await User.updateOne({ _id: userId }, { $set: { two_factor_enabled: enabled } });
}

export interface Profile {
  id: string;
  email: string;
  is_verified: boolean;
  two_factor_enabled: boolean;
  created_at: Date;
  last_login_at?: Date;
}

export async function getProfile(userId: Types.ObjectId | string): Promise<Profile> {
  const user = await User.findById(userId);
  if (!user) {
    throw new UnauthorizedError();
  }
  return {
    id: user._id.toString(),
    email: user.email,
    is_verified: user.is_verified,
    two_factor_enabled: user.two_factor_enabled,
    created_at: user.created_at,
    last_login_at: user.last_login_at,
  };
}

/** Step 1: email a recovery code. Always succeeds to avoid account enumeration. */
export async function startRecovery(email: string): Promise<void> {
  const user = await User.findOne({ email });
  if (!user) return;
  const code = await createOtp(email, 'recovery');
  await sendRecoveryEmail(email, code);
}

export interface RecoveryVerifyResult {
  crypto_salt: string;
  recovery_wrappedDEK: string;
  recoveryToken: string;
}

/** Step 2: verify the recovery code and hand back the recovery envelope + a short-lived token. */
export async function verifyRecovery(email: string, code: string): Promise<RecoveryVerifyResult> {
  const result = await verifyOtp(email, 'recovery', code);
  throwOnOtpFailure(result);

  const user = await User.findOne({ email });
  if (!user) {
    throw new UnauthorizedError('Recovery is not available for this account');
  }

  return {
    crypto_salt: user.crypto_salt,
    recovery_wrappedDEK: user.recovery_wrappedDEK,
    recoveryToken: signRecoveryToken(email),
  };
}

export interface RecoveryResetInput {
  recoveryToken: string;
  authHash: string;
  cryptoSalt: string;
  wrappedDEK: string;
  recoveryWrappedDEK: string;
}

export interface RecoveryResetResult {
  tokens: TokenPair;
  wrappedDEK: string;
  userId: Types.ObjectId;
}

/** Step 3: rotate the account to the new master password + fresh envelopes. */
export async function resetWithRecovery(input: RecoveryResetInput): Promise<RecoveryResetResult> {
  let email: string;
  try {
    email = verifyRecoveryToken(input.recoveryToken);
  } catch {
    throw new UnauthorizedError('Recovery session expired. Start again.');
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new UnauthorizedError('Recovery is not available for this account');
  }

  user.password_hash = await hashAuthHash(input.authHash);
  user.crypto_salt = input.cryptoSalt;
  user.wrappedDEK = input.wrappedDEK;
  user.recovery_wrappedDEK = input.recoveryWrappedDEK;
  user.last_login_at = new Date();
  await user.save();

  // Invalidate every existing session — the master key has changed.
  await revokeAllForUser(user._id as Types.ObjectId);

  const tokens = await issueTokenPair(user._id as Types.ObjectId, user.email);
  return { tokens, wrappedDEK: user.wrappedDEK, userId: user._id as Types.ObjectId };
}

function throwOnOtpFailure(result: OtpVerifyResult): void {
  if (result === 'ok') return;
  const messages: Record<Exclude<OtpVerifyResult, 'ok'>, string> = {
    invalid: 'Incorrect code',
    expired: 'Code expired or not found. Request a new one.',
    too_many_attempts: 'Too many incorrect attempts. Request a new code.',
  };
  throw new UnauthorizedError(messages[result]);
}
