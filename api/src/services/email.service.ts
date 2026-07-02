import { Resend } from 'resend';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import { renderEmail } from '../lib/email-templates.js';

function ttlMinutes(): number {
  return Math.round(config.OTP_TTL_SECONDS / 60);
}

let resend: Resend | null = null;
let warned = false;

function getResend(): Resend | null {
  if (resend) return resend;
  if (!config.RESEND_API_KEY || !config.RESEND_FROM_EMAIL) {
    if (!warned) {
      logger.warn('RESEND_API_KEY/RESEND_FROM_EMAIL not set — emails will be logged, not sent');
      warned = true;
    }
    return null;
  }
  resend = new Resend(config.RESEND_API_KEY);
  return resend;
}

async function send(to: string, subject: string, html: string, text: string): Promise<void> {
  const client = getResend();
  if (!client) {
    // Graceful degradation: in dev without Resend, log so flows remain testable.
    logger.info({ to, subject, text }, 'Email (not sent — Resend unconfigured)');
    return;
  }
  await client.emails.send({ from: config.RESEND_FROM_EMAIL!, to, subject, html, text });
}

export function sendOtpEmail(to: string, code: string): Promise<void> {
  const mins = ttlMinutes();
  const subject = 'Your Cloak sign-in code';
  const text = `Your Cloak one-time code is ${code}. It expires in ${mins} minutes. If you didn't request this, ignore this email.`;
  const html = renderEmail({
    preheader: `Your Cloak code is ${code}`,
    heading: 'Confirm your sign-in',
    intro: 'Use the one-time code below to finish signing in to your vault.',
    code,
    codeCaption: `Expires in ${mins} minutes`,
    footerNote:
      "If you didn't try to sign in, you can safely ignore this email — your vault stays locked without this code.",
  });
  return send(to, subject, html, text);
}

export function sendVerificationEmail(to: string, code: string): Promise<void> {
  const mins = ttlMinutes();
  const subject = 'Verify your Cloak account';
  const text = `Welcome to Cloak. Your email verification code is ${code}. It expires in ${mins} minutes.`;
  const html = renderEmail({
    preheader: `Verify your email — code ${code}`,
    heading: 'Welcome to Cloak',
    intro: 'Enter this code in the app to verify your email and activate your vault.',
    code,
    codeCaption: `Expires in ${mins} minutes`,
    body: [
      'Cloak encrypts everything on your device before it ever reaches our servers — this step just confirms your email is really yours.',
    ],
  });
  return send(to, subject, html, text);
}

export function sendRecoveryEmail(to: string, code: string): Promise<void> {
  const mins = ttlMinutes();
  const subject = 'Recover your Cloak vault';
  const text = `Your Cloak recovery code is ${code}. It expires in ${mins} minutes. You'll also need your recovery key to restore access.`;
  const html = renderEmail({
    preheader: `Your Cloak recovery code is ${code}`,
    heading: 'Recover your vault',
    intro: 'Enter this code in the app to confirm it\u2019s you. You\u2019ll then use your recovery key to set a new master password.',
    code,
    codeCaption: `Expires in ${mins} minutes`,
    footerNote:
      "If you didn't request account recovery, ignore this email and consider changing your master password — this code alone can't unlock your vault.",
  });
  return send(to, subject, html, text);
}
