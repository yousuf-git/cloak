import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1),

  JWT_SECRET: z.string().min(32),
  REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('30d'),
  // Hard ceiling on one sign-in. Rotation slides REFRESH_TOKEN_TTL forward, so
  // without this a session that is used often never ends.
  SESSION_MAX_TTL: z.string().default('90d'),

  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  INVITATION_TTL_DAYS: z.coerce.number().int().positive().default(7),
  // Drives the audit log's TTL index. Changing it rebuilds that index.
  AUDIT_RETENTION_DAYS: z.coerce.number().int().positive().default(365),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  // Failed auth/OTP attempts allowed per window (successful requests don't count).
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_API_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_UPLOAD_MAX: z.coerce.number().int().positive().default(20),

  CORS_ORIGIN: z.string().default('*'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // How this deployment is reached from the outside. Baked into invitation join
  // keys, so a wrong value hands new members an address they cannot connect to.
  PUBLIC_URL: z.string().url().optional(),
  // Shown on the status page and in the desktop client's connect screen, so an
  // operator running more than one deployment can tell them apart.
  SERVER_NAME: z.string().min(1).max(60).default('Cloak Server'),

  /**
   * Claims ownership of a fresh deployment. Hashed into the database on first
   * boot and spent when the first owner account is created; after that it is
   * ignored and should be removed from the environment.
   */
  OWNERSHIP_KEY: z.string().min(24).optional(),
  /** Unlocks the detailed half of the status page for a browser without a session. */
  HEALTH_TOKEN: z.string().min(24).optional(),

  // Optional integrations — absence disables the feature, never crashes the app.
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
});

/**
 * A variable present but empty means "not set".
 *
 * `.env.example` ships every optional key spelled out with nothing after the
 * `=`, which is what makes it readable. Without this, an operator who simply
 * does not use email hits `RESEND_FROM_EMAIL: Invalid email address` and the
 * server refuses to start over a feature they never asked for.
 */
const present = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => value !== undefined && value !== ''),
);

const parsed = envSchema.safeParse(present);

if (!parsed.success) {
  // Crash early: never discover missing config at request time.
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  // eslint-disable-next-line no-console
  console.error(
    `Invalid environment configuration:\n${issues}\n\n` +
      `Fix these in .env and start again. Run ./setup.sh if you have not generated one yet.`,
  );
  process.exit(1);
}

export const config = Object.freeze({
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
  // Never undefined downstream. The status page flags the fallback rather than
  // letting a production deployment mint join keys pointing at localhost.
  publicUrl: (parsed.data.PUBLIC_URL ?? `http://localhost:${parsed.data.PORT}`).replace(/\/$/, ''),
  publicUrlConfigured: parsed.data.PUBLIC_URL !== undefined,
  mailConfigured: Boolean(parsed.data.RESEND_API_KEY && parsed.data.RESEND_FROM_EMAIL),
});

export type Config = typeof config;
