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
  const html = renderEmail('otp', {
    subject,
    preheader: `Your Cloak code is ${code}`,
    hero: 'code',
    codeLabel: 'One-time sign-in code',
    code,
    codeCaption: `Expires in ${mins} min`,
    heading: 'Confirm it\u2019s you',
    intro: 'Enter this in the app to finish signing in.',
    specs: [
      { label: 'Valid for', value: `${mins} minutes` },
      { label: 'Uses', value: 'once' },
      { label: 'Vault', value: 'stays locked until entered' },
    ],
    note: "Didn't try to sign in? Ignore this email — the code is useless on its own.",
  });
  return send(to, subject, html, text);
}

export function sendVerificationEmail(to: string, code: string): Promise<void> {
  const mins = ttlMinutes();
  const subject = 'Verify your Cloak account';
  const text = `Welcome to Cloak. Your email verification code is ${code}. It expires in ${mins} minutes.`;
  const html = renderEmail('verify', {
    subject,
    preheader: `Verify your email — code ${code}`,
    hero: 'code',
    codeLabel: 'Email verification code',
    code,
    codeCaption: `Expires in ${mins} min`,
    heading: 'Welcome to Cloak',
    intro: 'Enter this in the app to activate your vault.',
    specs: [
      { label: 'Valid for', value: `${mins} minutes` },
      { label: 'Encryption', value: 'on your device' },
      { label: 'We store', value: 'ciphertext only' },
    ],
    note: 'Your vault stays locked until this address is verified.',
  });
  return send(to, subject, html, text);
}

export function sendRecoveryEmail(to: string, code: string): Promise<void> {
  const mins = ttlMinutes();
  const subject = 'Recover your Cloak vault';
  const text = `Your Cloak recovery code is ${code}. It expires in ${mins} minutes. You'll also need your recovery key to restore access.`;
  const html = renderEmail('recovery', {
    subject,
    preheader: `Your Cloak recovery code is ${code}`,
    hero: 'code',
    codeLabel: 'Account recovery code',
    code,
    codeCaption: `Expires in ${mins} min`,
    heading: 'Recover your vault',
    intro: 'This confirms you control this inbox. Your recovery key does the rest.',
    specs: [
      { label: 'Valid for', value: `${mins} minutes` },
      { label: 'Also required', value: 'your recovery key' },
      { label: 'This code alone', value: 'cannot unlock anything' },
    ],
    note: "Didn't request recovery? Ignore this email and consider changing your master password.",
  });
  return send(to, subject, html, text);
}

export function sendInvitationEmail(
  to: string,
  orgName: string,
  role: string,
  token: string,
): Promise<void> {
  const days = config.INVITATION_TTL_DAYS;
  const subject = `You've been invited to ${orgName} on Cloak`;
  const text =
    `You've been invited to join ${orgName} on Cloak as ${role}. ` +
    `Open Cloak, sign in with this email address, and enter this invitation code: ${token}. ` +
    `It expires in ${days} days.`;
  const html = renderEmail('invitation', {
    subject,
    preheader: `Join ${orgName} on Cloak`,
    hero: 'invite',
    codeLabel: "You've been invited to",
    orgName,
    role,
    code: token,
    codeCaption: `Expires in ${days} days`,
    heading: 'Joining takes two steps',
    intro: 'Open Cloak, sign in with this email address, and enter the code above to accept.',
    paragraphs: [
      "Accepting does not unlock anything on its own \u2014 an admin still has to seal the organization's key to your device. That second step is what keeps these secrets unreadable to our servers.",
    ],
    specs: [
      { label: 'Step 1', value: 'you enter the code' },
      { label: 'Step 2', value: 'an admin grants the key' },
      { label: 'Until then', value: 'nothing is readable' },
    ],
    note: "Weren't expecting this? Ignore it — nothing is shared with you until you accept.",
  });
  return send(to, subject, html, text);
}
