import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config/index.js';

/**
 * Renders the HTML emails held in `api/templates/`. Markup lives in those files,
 * not in here — this module only loads them, fills in values, and escapes.
 *
 * The directory resolves two levels up from this file, which lands on
 * `api/templates/` from both `src/lib/` under tsx and `dist/lib/` after a build,
 * so no copy step is needed.
 */
const TEMPLATE_DIR = fileURLToPath(new URL('../../templates/', import.meta.url));

const APP_URL = 'https://cloak.commit4solutions.com';
// The app's mono mark, matching the auth screen's lockup. Email clients cannot
// reach a repo file (only a public URL), and they cannot run the CSS filter the
// app uses to whiten the artwork — so web/public carries a pre-inverted copy.
const LOGO_URL = `${APP_URL}/cloak-mono-light.png`;

export type TemplateName = 'otp' | 'verify' | 'recovery' | 'invitation';

export interface Spec {
  label: string;
  value: string;
}

export interface EmailContent {
  /** Inbox preview line. */
  preheader: string;
  subject: string;
  /** Which hero panel leads the email. */
  hero: 'code' | 'invite';
  /** Mono label above the hero. */
  codeLabel: string;
  /** OTP or invitation token. */
  code?: string;
  codeCaption?: string;
  /** Invitation hero only. */
  orgName?: string;
  role?: string;
  heading: string;
  intro: string;
  /** Prose paragraphs, for the cases a spec row cannot carry. */
  paragraphs?: string[];
  /** Scannable key/value facts, shown as a spec sheet. */
  specs?: Spec[];
  /** Closing aside, set off by an accent bar. */
  note?: string;
}

type Value = string | string[] | Spec[] | undefined;

const cache = new Map<string, string>();

function load(relativePath: string): string {
  const cached = cache.get(relativePath);
  // Re-read every time in dev so template edits show up without a restart.
  if (cached !== undefined && config.isProd) return cached;
  const source = readFileSync(join(TEMPLATE_DIR, relativePath), 'utf8');
  cache.set(relativePath, source);
  return source;
}

/**
 * Escape interpolated values. Organization names and roles reach these templates
 * from user input, so raw interpolation would let someone inject markup into an
 * email that other people receive.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    // Braces too: the rendered body is substituted into the layout and passed
    // through one more time, so an org named "{{code}}" could otherwise reach a
    // placeholder pass as markup rather than as text.
    .replace(/\{/g, '&#123;');
}

/**
 * A deliberately small mustache subset, enough for these templates:
 *   {{> name}}        include partials/name.html
 *   {{#each list}}…{{/each}}   repeat, with {{.}} as the item
 *   {{#key}}…{{/key}} keep the block only when the value is non-empty
 *   {{{key}}}         insert already-rendered HTML
 *   {{key}}           insert an escaped value
 */
function render(template: string, vars: Record<string, Value>): string {
  let out = template;

  out = out.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_m, name: string) =>
    render(load(`partials/${name}.html`), vars),
  );

  out = out.replace(
    /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (_m, key: string, block: string) => {
      const list = vars[key];
      if (!Array.isArray(list)) return '';
      return list
        .map((item) =>
          // Scalars fill {{.}}; objects expose their own fields to the block.
          typeof item === 'string'
            ? block.replace(/\{\{\.\}\}/g, escapeHtml(item))
            : render(block, { ...vars, ...item }),
        )
        .join('');
    },
  );

  out = out.replace(
    /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
    (_m, key: string, block: string) => {
      const value = vars[key];
      const present = Array.isArray(value) ? value.length > 0 : Boolean(value);
      return present ? block : '';
    },
  );

  out = out.replace(/\{\{\{(\w+)\}\}\}/g, (_m, key: string) => {
    const value = vars[key];
    return typeof value === 'string' ? value : '';
  });

  out = out.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
    const value = vars[key];
    return typeof value === 'string' ? escapeHtml(value) : '';
  });

  return out;
}

/** "09 Sep 2026 · 14:22 UTC" — the issue stamp on the document header. */
function issueStamp(): string {
  const now = new Date();
  const date = now.toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const time = now.toLocaleTimeString('en-GB', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${date} · ${time} UTC`;
}

export function renderEmail(name: TemplateName, c: EmailContent): string {
  const shared: Record<string, Value> = {
    preheader: c.preheader,
    subject: c.subject,
    codeLabel: c.codeLabel,
    heading: c.heading,
    intro: c.intro,
    code: c.code,
    codeCaption: c.codeCaption,
    orgName: c.orgName,
    role: c.role,
    paragraphs: c.paragraphs,
    specs: c.specs,
    note: c.note,
    appUrl: APP_URL,
    appDomain: APP_URL.replace('https://', ''),
    logoUrl: LOGO_URL,
    issuedAt: issueStamp(),
  };

  const hero = render(load(`partials/hero-${c.hero}.html`), shared);
  const content = render(load(`${name}.html`), shared);
  return render(load('layout.html'), { ...shared, hero, content });
}
