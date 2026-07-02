import { z } from 'zod';

const email = z.string().trim().toLowerCase().email();
// authHash / wrappedDEK are base64 blobs produced by the Rust core.
const b64 = z.string().min(1).max(4096);

export const signupSchema = z.object({
  email,
  authHash: b64,
  cryptoSalt: z.string().min(16).max(512),
  wrappedDEK: b64,
  recoveryWrappedDEK: b64,
});

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

export const setTwoFactorSchema = z.object({ enabled: z.boolean() });

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
