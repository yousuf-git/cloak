/**
 * Dependency-free RFC 4180 CSV parser + Google Password Manager column mapper.
 *
 * Google's "Passwords > Export" produces a UTF-8 CSV with the header
 * `name,url,username,password,note`. Google (and third-party managers) drift
 * on column names, add/remove columns, and quote values containing commas or
 * newlines — so we parse defensively and let the user re-map columns before
 * import. No plaintext is persisted here; the cleaned rows are handed straight
 * to the encrypt-then-save pipeline.
 */

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

/** Parse CSV text into a header row + data rows, honouring RFC 4180 quoting. */
export function parseCsv(text: string): ParsedCsv {
  const src = text.replace(/^﻿/, ''); // strip BOM
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  let started = false;

  const pushField = () => {
    record.push(field);
    field = '';
  };
  const pushRecord = () => {
    pushField();
    // Ignore blank trailing lines (a single empty field).
    if (!(record.length === 1 && record[0] === '')) records.push(record);
    record = [];
    started = false;
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    started = true;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      pushField();
    } else if (ch === '\n') {
      pushRecord();
    } else if (ch === '\r') {
      // swallow; \n handles the record break
    } else {
      field += ch;
    }
  }
  if (started || field !== '' || record.length) pushRecord();

  const [headers = [], ...rows] = records;
  return { headers, rows };
}

export type CredField = 'name' | 'url' | 'username' | 'password' | 'note';

export const CRED_FIELDS: CredField[] = ['name', 'url', 'username', 'password', 'note'];

/** Column index in the CSV for each credential field (null = unmapped). */
export type ColumnMapping = Record<CredField, number | null>;

const HEADER_SYNONYMS: Record<CredField, string[]> = {
  name: ['name', 'title', 'account', 'label'],
  url: ['url', 'website', 'site', 'origin', 'web site', 'login uri', 'login_uri'],
  username: ['username', 'user', 'login', 'login name', 'email', 'user name'],
  password: ['password', 'pass', 'pwd'],
  note: ['note', 'notes', 'comment', 'comments', 'extra'],
};

/** Best-effort auto-mapping of CSV headers to credential fields. */
export function autoMap(headers: string[]): ColumnMapping {
  const norm = headers.map((h) => h.trim().toLowerCase());
  const mapping: ColumnMapping = { name: null, url: null, username: null, password: null, note: null };
  for (const field of CRED_FIELDS) {
    const idx = norm.findIndex((h) => HEADER_SYNONYMS[field].includes(h));
    if (idx !== -1) mapping[field] = idx;
  }
  return mapping;
}

export interface ImportRow {
  name: string;
  url: string;
  username: string;
  password: string;
  note: string;
}

/** Project the parsed rows through a column mapping into typed import rows. */
export function toImportRows(parsed: ParsedCsv, mapping: ColumnMapping): ImportRow[] {
  const cell = (row: string[], idx: number | null) =>
    idx === null ? '' : (row[idx] ?? '').trim();
  return parsed.rows
    .map((row) => ({
      name: cell(row, mapping.name),
      url: cell(row, mapping.url),
      username: cell(row, mapping.username),
      password: cell(row, mapping.password),
      note: cell(row, mapping.note),
    }))
    // A row is worth importing only if it carries a password or a name.
    .filter((r) => r.password || r.name);
}

/** A row must have a name (falls back to url/username) and a password to import. */
export function normalizeRow(r: ImportRow): ImportRow {
  const name = r.name || r.url || r.username || 'Untitled';
  return { ...r, name };
}
