import { Otp, type OtpPurpose } from '../models/otp.model.js';
import { generateNumericOtp, sha256, timingSafeEqualHex } from '../lib/hashing.js';
import { config } from '../config/index.js';
import { futureDate } from '../utils/duration.js';

const MAX_ATTEMPTS = 5;

/**
 * Create a fresh OTP for an email+purpose, replacing any prior codes.
 * Returns the raw code so the caller can dispatch it by email.
 */
export async function createOtp(email: string, purpose: OtpPurpose): Promise<string> {
  const code = generateNumericOtp(6);
  await Otp.deleteMany({ email, purpose });
  await Otp.create({
    email,
    purpose,
    code_hash: sha256(code),
    expires_at: futureDate(config.OTP_TTL_SECONDS * 1000),
  });
  return code;
}

export type OtpVerifyResult = 'ok' | 'invalid' | 'expired' | 'too_many_attempts';

/** Verify and consume an OTP. Deletes it on success. */
export async function verifyOtp(
  email: string,
  purpose: OtpPurpose,
  code: string,
): Promise<OtpVerifyResult> {
  const record = await Otp.findOne({ email, purpose });
  if (!record) return 'expired';

  if (record.expires_at.getTime() < Date.now()) {
    await record.deleteOne();
    return 'expired';
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await record.deleteOne();
    return 'too_many_attempts';
  }

  if (!timingSafeEqualHex(record.code_hash, sha256(code))) {
    record.attempts += 1;
    await record.save();
    return 'invalid';
  }

  await record.deleteOne();
  return 'ok';
}
