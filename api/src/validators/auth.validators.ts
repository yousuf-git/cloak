import { z } from 'zod';

const email = z.string().trim().toLowerCase().email();
// authHash / wrappedDEK are base64 blobs produced by the Rust core.
const b64 = z.string().min(1).max(4096);

const displayName = z.string().trim().min(1).max(80);

export const signupSchema = z.object({
  email,
  name: displayName,
  authHash: b64,
  cryptoSalt: z.string().min(16).max(512),
  wrappedDEK: b64,
  recoveryWrappedDEK: b64,
  identityPublicKey: z.string().min(32).max(512),
  wrappedIdentitySk: b64,
  // Present only for the very first account on a self-hosted deployment, where
  // it proves the caller holds the server's ownership key.
  claimTicket: z.string().min(1).max(2048).optional(),
  // Every account starts with an organization; the client mints its key
  // material alongside the account's own.
  defaultOrg: z.object({
    name: z.string().trim().min(1).max(80),
    wrapped_org_dek: b64,
    org_recovery_salt: z.string().min(16).max(512),
    org_recovery_wrappedDEK: b64,
  }),
});

export const updateProfileSchema = z.object({ name: displayName });

export const preloginSchema = z.object({ email });

export const loginSchema = z.object({ email, authHash: b64 });

export const twoFactorSchema = z.object({
  email,
  otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

export const verifyEmailSchema = z.object({
  email,
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(1) });

export const logoutSchema = z.object({ refreshToken: z.string().min(1).optional() });

export const securityLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const sessionParamSchema = z.object({
  sessionId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid session id'),
});

export const setTwoFactorSchema = z.object({ enabled: z.boolean() });

export const resendVerificationSchema = z.object({ email });

export const recoveryStartSchema = z.object({ email });

export const recoveryVerifySchema = z.object({
  email,
  otp: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

export const recoveryResetSchema = z.object({
  recoveryToken: z.string().min(1),
  authHash: b64,
  cryptoSalt: z.string().min(16).max(512),
  wrappedDEK: b64,
  recoveryWrappedDEK: b64,
});

export type SignupBody = z.infer<typeof signupSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
