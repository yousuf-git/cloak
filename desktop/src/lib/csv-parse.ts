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
  /** Empty for a standalone credential. */
  project_id: string;
}

/** An import row, with where it came from so the import log can point back at it. */
export interface SourcedRow extends ImportRow {
  /** Line in the file, counting the header as line 1. */
  line: number;
}

/**
 * The header Cloak's own export writes for the project column.
 *
 * Deliberately not auto-mapped from synonyms or offered in the column picker: a
 * project id only means something to the organization that exported it, so the
 * column is only trusted in a file that came out of Cloak.
 */
export const PROJECT_HEADER = 'project_id';

export function projectColumn(headers: string[]): number | null {
  const idx = headers.findIndex((h) => h.trim().toLowerCase() === PROJECT_HEADER);
  return idx === -1 ? null : idx;
}

/** Project the parsed rows through a column mapping into typed import rows. */
export function toImportRows(parsed: ParsedCsv, mapping: ColumnMapping): SourcedRow[] {
  const cell = (row: string[], idx: number | null) =>
    idx === null ? '' : (row[idx] ?? '').trim();
  const project = projectColumn(parsed.headers);
  return parsed.rows
    .map((row, i) => ({
      name: cell(row, mapping.name),
      url: cell(row, mapping.url),
      username: cell(row, mapping.username),
      password: cell(row, mapping.password),
      note: cell(row, mapping.note),
      project_id: cell(row, project),
      line: i + 2,
    }))
    // A row is worth importing only if it carries a password or a name.
    .filter((r) => r.password || r.name);
}

/** A row must have a name (falls back to url/username) and a password to import. */
export function normalizeRow<T extends ImportRow>(r: T): T {
  const name = r.name || r.url || r.username || 'Untitled';
  return { ...r, name };
}

const OBJECT_ID = /^[a-f\d]{24}$/i;

/** What a row's project cell resolves to in the organization being imported into. */
export type ProjectLink =
  | { kind: 'none' }
  | { kind: 'linked'; projectId: string; projectName: string }
  /** Shaped like a project id, but no project in this organization has it. */
  | { kind: 'unknown'; value: string }
  /** Not a project id at all. */
  | { kind: 'invalid'; value: string };

export function resolveProject(
  value: string,
  projects: { _id: string; name: string }[],
): ProjectLink {
  const trimmed = value.trim();
  if (!trimmed) return { kind: 'none' };
  if (!OBJECT_ID.test(trimmed)) return { kind: 'invalid', value: trimmed };
  const project = projects.find((p) => p._id.toLowerCase() === trimmed.toLowerCase());
  return project
    ? { kind: 'linked', projectId: project._id, projectName: project.name }
    : { kind: 'unknown', value: trimmed };
}
