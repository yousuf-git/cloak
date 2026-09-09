import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { asyncHandler, ok } from '../lib/http.js';
import { config } from '../config/index.js';
import { validate } from '../middlewares/validate.js';
import { authLimiter } from '../middlewares/rate-limit.js';
import { requireAuth } from '../middlewares/require-auth.js';
import { claimOwnership } from '../services/deployment.service.js';
import { serverInfo, serverStatus } from '../services/status.service.js';

const STATUS_PAGE = fileURLToPath(new URL('../../templates/status.html', import.meta.url));

/**
 * Read once at boot. The page never changes at runtime, and re-reading it per
 * request would put disk I/O on an endpoint that refreshes every few seconds.
 */
const statusPage = readFileSync(STATUS_PAGE, 'utf8');

/**
 * Constant-time token check. A plain `===` on a secret compared thousands of
 * times by an auto-refreshing page is exactly the shape timing attacks like.
 */
function hasHealthToken(req: Request): boolean {
  const supplied = typeof req.query.key === 'string' ? req.query.key : null;
  if (!supplied || !config.HEALTH_TOKEN) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(config.HEALTH_TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Safe to embed inside a <script> block: closes no tag, opens no comment. */
function embed(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/-->/g, '--\\u003e');
}

export const statusPageRouter = Router();

// The operator's dashboard. Public tier is deliberately thin — anyone who finds
// the address can read it — and the detailed tier needs HEALTH_TOKEN.
statusPageRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const detailed = hasHealthToken(req);
    const data = detailed ? await serverStatus() : await serverInfo();
    const endpoint = detailed
      ? `/status.json?key=${encodeURIComponent(config.HEALTH_TOKEN!)}`
      : '/status.json';

    // Overrides helmet's default policy, which forbids the inline <style> and
    // <script> this page is built from. Deliberately narrow: this page loads
    // nothing external and talks only to its own origin.
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
    res.type('html').send(
      statusPage
        .replace('{{TITLE}}', `${config.SERVER_NAME} · status`)
        .replace('{{BOOTSTRAP}}', embed(data))
        .replace('{{ENDPOINT}}', embed(endpoint)),
    );
  }),
);

// Machine-readable twin of the page above, same two tiers. Drives the page's
// own refresh loop and anything else an operator wants to poll.
statusPageRouter.get(
  '/status.json',
  asyncHandler(async (req, res) => {
    ok(res, hasHealthToken(req) ? await serverStatus() : await serverInfo());
  }),
);

/** Mounted under /api/v1/server. */
export const serverRouter = Router();

/**
 * Pre-flight for the desktop client's connect screen: is this a Cloak server, do
 * we speak the same contract, is it healthy, and has anyone claimed it yet.
 * Unauthenticated by necessity — the client has no account here yet.
 */
serverRouter.get(
  '/info',
  asyncHandler(async (_req, res) => {
    ok(res, await serverInfo());
  }),
);

const claimSchema = z.object({
  ownership_key: z.string().min(1, 'Enter the ownership key from your server .env'),
});

// Guessing a 32-byte key is hopeless, but the limiter keeps a flood of attempts
// off the CPU and out of the logs. Only failures count toward the budget.
serverRouter.post(
  '/claim',
  authLimiter,
  validate({ body: claimSchema }),
  asyncHandler(async (req, res) => {
    const ticket = await claimOwnership(req.body.ownership_key);
    ok(res, { claim_ticket: ticket });
  }),
);

// The full panel for a signed-in operator, so the desktop app can show the same
// metrics without anyone handling HEALTH_TOKEN.
serverRouter.get(
  '/status',
  requireAuth,
  asyncHandler(async (_req, res) => {
    ok(res, await serverStatus());
  }),
);
