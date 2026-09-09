import { createHmac } from 'node:crypto';
import type { Types } from 'mongoose';
import { User } from '../models/user.model.js';
import { Org } from '../models/org.model.js';
import { Membership } from '../models/membership.model.js';
import { Invitation } from '../models/invitation.model.js';
import { config } from '../config/index.js';
import {
  hashAuthHash,
  verifyAuthHash,
} from '../lib/hashing.js';
import { signRecoveryToken, verifyRecoveryToken } from '../lib/jwt.js';
import {
  ConflictError,
  EmailNotVerifiedError,
  ForbiddenError,
  UnauthorizedError,
} from '../lib/errors.js';
import { isClaimed, markClaimed, verifyClaimTicket } from './deployment.service.js';
import { createOtp, verifyOtp, type OtpVerifyResult } from './otp.service.js';
import { sendOtpEmail, sendVerificationEmail, sendRecoveryEmail } from './email.service.js';
import { issueTokenPair, revokeAllForUser, type TokenPair } from './token.service.js';

export interface SignupInput {
  email: string;
  name: string;
  authHash: string;
  cryptoSalt: string;
  wrappedDEK: string;
  recoveryWrappedDEK: string;
  identityPublicKey: string;
  wrappedIdentitySk: string;
  /** Proof of the ownership key. Required for, and only for, the first account. */
  claimTicket?: string;
  defaultOrg: {
    name: string;
    wrapped_org_dek: string;
    org_recovery_salt: string;
    org_recovery_wrappedDEK: string;
  };
}

/**
 * Who is allowed to open an account on this deployment.
 *
 * A self-hosted server is reachable by anyone who finds the address, so signup
 * is closed by construction: the first account needs the ownership key, and
 * every account after it needs an invitation addressed to that exact email.
 */
async function assertSignupAllowed(email: string, claimTicket?: string): Promise<boolean> {
  if (!(await isClaimed())) {
    if (!claimTicket) {
      throw new ForbiddenError('This server has no owner yet — claim it with the ownership key first');
    }
    await verifyClaimTicket(claimTicket);
    return true;
  }

  // Someone arriving with a ticket for a server that has since been claimed
  // needs to hear that, not a generic "invite-only".
  if (claimTicket) {
    throw new ConflictError('This server already has an owner');
  }

  const invited = await Invitation.exists({ email, status: 'pending', expires_at: { $gt: new Date() } });
  if (!invited) {
    throw new ForbiddenError(
      'This server is invite-only. Ask an administrator to send an invitation to this address.',
    );
  }
  return false;
}

/**
 * Create the account together with its first organization. Orgs are mandatory —
 * a solo user's vault is an org of one — so signup provisions the user, their
 * identity keypair, the org, and the owner membership in a single step.
 */
export async function signup(input: SignupInput): Promise<{ orgId: string }> {
  const claimsDeployment = await assertSignupAllowed(input.email, input.claimTicket);

  const existing = await User.findOne({ email: input.email });
  if (existing) {
    // Distinguished so the client can offer to finish verifying rather than
    // leaving the person stuck at "already exists" with no way forward.
    if (!existing.is_verified) {
      throw new EmailNotVerifiedError('This email is registered but not verified yet', 409);
    }
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await hashAuthHash(input.authHash);
  const user = await User.create({
    email: input.email,
    name: input.name,
    password_hash: passwordHash,
    crypto_salt: input.cryptoSalt,
    wrappedDEK: input.wrappedDEK,
    recovery_wrappedDEK: input.recoveryWrappedDEK,
    identity_public_key: input.identityPublicKey,
    wrapped_identity_sk: input.wrappedIdentitySk,
    is_verified: false,
  });

  // Spend the ownership key before building anything else, and only if this
  // request won the race for it. A second signup arriving at the same moment
  // loses here rather than becoming a second owner.
  if (claimsDeployment && !(await markClaimed(user._id))) {
    await User.deleteOne({ _id: user._id });
    throw new ConflictError('This server already has an owner');
  }

  const org = await Org.create({
    name: input.defaultOrg.name,
    owner_id: user._id,
    org_recovery_salt: input.defaultOrg.org_recovery_salt,
    org_recovery_wrappedDEK: input.defaultOrg.org_recovery_wrappedDEK,
  });

  await Membership.create({
    org_id: org._id,
    user_id: user._id,
    role: 'owner',
    status: 'active',
    wrapped_org_dek: input.defaultOrg.wrapped_org_dek,
    joined_at: new Date(),
  });

  const code = await createOtp(input.email, 'email_verify');
  await sendVerificationEmail(input.email, code);

  return { orgId: org._id.toString() };
}

/**
 * Attach an identity keypair to an account that predates them. The secret half
 * arrives already wrapped by the user's DEK — the server stores both halves but
 * can only ever read the public one.
 */
export async function setIdentity(
  userId: Types.ObjectId | string,
  identityPublicKey: string,
  wrappedIdentitySk: string,
): Promise<void> {
  const result = await User.updateOne(
    { _id: userId },
    { $set: { identity_public_key: identityPublicKey, wrapped_identity_sk: wrappedIdentitySk } },
  );
  if (result.matchedCount === 0) throw new UnauthorizedError();
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
  | {
      status: 'tokens';
      tokens: TokenPair;
      wrappedDEK: string;
      wrappedIdentitySk?: string;
      userId: Types.ObjectId;
    }
  | { status: '2fa_required' };

export async function login(email: string, authHash: string): Promise<LoginOutcome> {
  const user = await User.findOne({ email });
  // Constant-ish work even on unknown users: verify against a decoy is skipped
  // for simplicity, but we always return the same generic error below.
  if (!user || !(await verifyAuthHash(user.password_hash, authHash))) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Checked only after the password matches, so an unverified account's state
  // is never disclosed to someone who cannot already sign in as them. A fresh
  // code goes out here: whoever gets this far owns the account, and the code
  // from signup has almost certainly expired by the time they come back.
  if (!user.is_verified) {
    const code = await createOtp(email, 'email_verify');
    await sendVerificationEmail(email, code);
    throw new EmailNotVerifiedError();
  }

  if (user.two_factor_enabled) {
    const code = await createOtp(email, 'login_2fa');
    await sendOtpEmail(email, code);
    return { status: '2fa_required' };
  }

  const tokens = await issueTokenPair(user._id as Types.ObjectId, user.email);
  user.last_login_at = new Date();
  await user.save();
  return {
    status: 'tokens',
    tokens,
    wrappedDEK: user.wrappedDEK,
    wrappedIdentitySk: user.wrapped_identity_sk,
    userId: user._id as Types.ObjectId,
  };
}

export interface TwoFactorResult {
  tokens: TokenPair;
  wrappedDEK: string;
  wrappedIdentitySk?: string;
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
  return {
    tokens,
    wrappedDEK: user.wrappedDEK,
    wrappedIdentitySk: user.wrapped_identity_sk,
    userId: user._id as Types.ObjectId,
  };
}

/**
 * Send a fresh verification code. Returns nothing either way — a caller must
 * not be able to learn whether an address is registered, or whether it is
 * already verified, by watching this.
 */
export async function resendVerification(email: string): Promise<void> {
  const user = await User.findOne({ email }).select('is_verified').lean();
  if (!user || user.is_verified) return;
  const code = await createOtp(email, 'email_verify');
  await sendVerificationEmail(email, code);
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
  name?: string;
  is_verified: boolean;
  two_factor_enabled: boolean;
  identity_public_key?: string;
  wrapped_identity_sk?: string;
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
    name: user.name,
    is_verified: user.is_verified,
    two_factor_enabled: user.two_factor_enabled,
    identity_public_key: user.identity_public_key,
    wrapped_identity_sk: user.wrapped_identity_sk,
    created_at: user.created_at,
    last_login_at: user.last_login_at,
  };
}

/** Rename the account holder. The name is metadata — it is never part of any key. */
export async function updateProfile(
  userId: Types.ObjectId | string,
  input: { name: string },
): Promise<Profile> {
  const user = await User.findByIdAndUpdate(userId, { $set: { name: input.name } }, { new: true });
  if (!user) {
    throw new UnauthorizedError();
  }
  return getProfile(user._id);
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
  wrappedIdentitySk?: string;
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
  return {
    tokens,
    wrappedDEK: user.wrappedDEK,
    // The DEK is unchanged by a password reset, so the identity envelope that
    // it wraps still opens — no re-keying needed here.
    wrappedIdentitySk: user.wrapped_identity_sk,
    userId: user._id as Types.ObjectId,
  };
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
