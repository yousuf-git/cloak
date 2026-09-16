import { resolveProject, type SourcedRow } from './csv-parse';

interface ProjectRef {
  _id: string;
  name: string;
}

/** What will happen to one row, decided before anything is written. */
export type Plan =
  | { status: 'ready'; projectId: string | null; projectName: string | null }
  /** Already in the vault, or earlier in this same file. */
  | { status: 'duplicate'; of: 'vault' | number }
  | { status: 'project_unknown'; value: string }
  | { status: 'project_invalid'; value: string };

export interface PlannedRow {
  row: SourcedRow;
  plan: Plan;
}

const dedupeKey = (name: string, username: string) =>
  `${name.trim().toLowerCase()}|${username.trim().toLowerCase()}`;

/**
 * Decide each row's fate up front, so the preview shows exactly what the import
 * will do.
 *
 * A row whose project cannot be resolved is held back rather than imported
 * standalone: that would quietly drop a link the file asked for. The log says
 * which rows, and why, so the file can be fixed and imported again — the rows
 * that did go in are then skipped as duplicates.
 */
export function planImport(
  rows: SourcedRow[],
  existing: { name: string; username: string }[],
  projects: ProjectRef[],
  dedupe: boolean,
): PlannedRow[] {
  const inVault = new Set(existing.map((c) => dedupeKey(c.name, c.username)));
  const firstLine = new Map<string, number>();

  return rows.map((row) => {
    const key = dedupeKey(row.name, row.username);
    if (dedupe && inVault.has(key)) return { row, plan: { status: 'duplicate', of: 'vault' } };
    if (dedupe && firstLine.has(key)) {
      return { row, plan: { status: 'duplicate', of: firstLine.get(key)! } };
    }

    const link = resolveProject(row.project_id, projects);
    if (link.kind === 'unknown') return { row, plan: { status: 'project_unknown', value: link.value } };
    if (link.kind === 'invalid') return { row, plan: { status: 'project_invalid', value: link.value } };

    firstLine.set(key, row.line);
    return {
      row,
      plan:
        link.kind === 'linked'
          ? { status: 'ready', projectId: link.projectId, projectName: link.projectName }
          : { status: 'ready', projectId: null, projectName: null },
    };
  });
}

export type LogStatus = 'imported' | 'failed' | 'duplicate' | 'project_unknown' | 'project_invalid';

export interface LogEntry {
  line: number;
  name: string;
  status: LogStatus;
  /** What happened to the row, and what to do about it if anything. */
  detail: string;
}

/** The log line for a row that was never attempted. */
export function heldBack(planned: PlannedRow): LogEntry {
  const { row, plan } = planned;
  const base = { line: row.line, name: row.name };
  switch (plan.status) {
    case 'duplicate':
      return {
        ...base,
        status: 'duplicate',
        detail:
          plan.of === 'vault'
            ? 'Skipped: a credential with this name and username is already in the vault.'
            : `Skipped: same name and username as line ${plan.of}.`,
      };
    case 'project_unknown':
      return {
        ...base,
        status: 'project_unknown',
        detail: `Not imported: no project in this organization has the id ${plan.value}. It may come from another organization's export, or the project was deleted. Correct the id, or clear it to import this credential standalone.`,
      };
    case 'project_invalid':
      return {
        ...base,
        status: 'project_invalid',
        detail: `Not imported: "${plan.value}" is not a project id. The project_id column takes the ids a Cloak export writes; clear the cell to import this credential standalone.`,
      };
    case 'ready':
      throw new Error('A ready row is imported, not held back');
  }
}

export function imported(planned: PlannedRow): LogEntry {
  const { row, plan } = planned;
  const project = plan.status === 'ready' ? plan.projectName : null;
  return {
    line: row.line,
    name: row.name,
    status: 'imported',
    detail: project ? `Imported into ${project}.` : 'Imported as a standalone credential.',
  };
}

export function failed(planned: PlannedRow, reason: string): LogEntry {
  return {
    line: planned.row.line,
    name: planned.row.name,
    status: 'failed',
    detail: `Not imported: the server refused it (${reason}). Try importing again.`,
  };
}

/** The log as text, for copying out of the app. */
export function logToText(entries: LogEntry[], ignoredEmpty: number): string {
  const lines = entries
    .slice()
    .sort((a, b) => a.line - b.line)
    .map((e) => `line ${e.line}\t${e.status}\t${e.name}\t${e.detail}`);
  if (ignoredEmpty > 0) lines.push(`${ignoredEmpty} empty row(s) ignored: no name and no password.`);
  return lines.join('\n');
}
