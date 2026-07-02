import { Schema, model } from 'mongoose';

export type OtpPurpose = 'login_2fa' | 'email_verify' | 'recovery';

export interface OtpDoc {
  email: string;
  purpose: OtpPurpose;
  code_hash: string;
  attempts: number;
  expires_at: Date;
  created_at: Date;
}

/** Short-lived one-time codes. Auto-expire via a TTL index on `expires_at`. */
const otpSchema = new Schema<OtpDoc>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    purpose: { type: String, enum: ['login_2fa', 'email_verify', 'recovery'], required: true },
    // Hash of the code — never store the raw OTP.
    code_hash: { type: String, required: true },
    attempts: { type: Number, required: true, default: 0 },
    expires_at: { type: Date, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
);

otpSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export const Otp = model<OtpDoc>('Otp', otpSchema);
