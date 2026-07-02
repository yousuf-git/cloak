/**
 * Lightweight, dependency-free .env parser + validator.
 *
 * Why not `envalid` / `dotenv`? `envalid` validates a *known* schema of
 * required variables (app boot config) and isn't meant for importing arbitrary
 * files, and `dotenv`'s entrypoint pulls in Node's `fs`/`path`, which don't
 * bundle cleanly into the Tauri webview. This parser mirrors dotenv's line
 * semantics and surfaces friendly, line-numbered errors for the import UX.
 */

export interface EnvParseResult {
  vars: Record<string, string>;
  count: number;
  errors: string[];
  encrypted: boolean;
}

const KEY_LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.]*)\s*=\s*(.*)?$/;

function unquote(raw: string): string {
  const v = raw.trim();
  if (
    (v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
    (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
  ) {
    return v.slice(1, -1);
  }
  // Strip trailing inline comment for unquoted values.
  const hash = v.indexOf(' #');
  return (hash >= 0 ? v.slice(0, hash) : v).trim();
}

export function parseEnv(src: string): EnvParseResult {
  const vars: Record<string, string> = {};
  const errors: string[] = [];
  let encrypted = false;

  const lines = src.split(/\r?\n/);
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const m = trimmed.match(KEY_LINE);
    if (!m) {
      errors.push(`Line ${i + 1}: not a valid KEY=value assignment.`);
      return;
    }
    const key = m[1]!;
    const value = unquote(m[2] ?? '');
    if (key === 'DOTENV_PUBLIC_KEY' || /^encrypted:/i.test(value)) encrypted = true;
    vars[key] = value;
  });

  const count = Object.keys(vars).filter((k) => k !== 'DOTENV_PUBLIC_KEY').length;
  if (count === 0 && errors.length === 0) {
    errors.push('No variables found — expected at least one KEY=value line.');
  }
  return { vars, count, errors, encrypted };
}
