import { describe, it, expect } from 'vitest';
import { autoMap, parseCsv, projectColumn, resolveProject, toImportRows } from './csv-parse';
import { credsToCsv, sampleCredsCsv } from './vault-export';

const AURORA = { _id: '6aaa58719191fa378c31546e', name: 'Aurora' };

describe('resolveProject', () => {
  it('treats an empty cell as a standalone credential', () => {
    expect(resolveProject('  ', [AURORA])).toEqual({ kind: 'none' });
  });

  it('links an id that belongs to a project in this organization', () => {
    expect(resolveProject(AURORA._id.toUpperCase(), [AURORA])).toEqual({
      kind: 'linked',
      projectId: AURORA._id,
      projectName: 'Aurora',
    });
  });

  it('tells a well-formed id with no project apart from a value that is not an id', () => {
    expect(resolveProject('6aaa58719191fa378c31546f', [AURORA])).toEqual({
      kind: 'unknown',
      value: '6aaa58719191fa378c31546f',
    });
    expect(resolveProject('Aurora', [AURORA])).toEqual({ kind: 'invalid', value: 'Aurora' });
  });
});

describe('credential CSV round trip', () => {
  it('reads project ids and line numbers back out of an export', () => {
    const csv = credsToCsv([
      { name: 'GitHub', url: '', username: 'octocat', password: 'pw', note: '', project_id: '' },
      { name: 'DB', url: '', username: 'app', password: 'pw', note: 'a, b', project_id: AURORA._id },
    ]);
    const parsed = parseCsv(csv);
    const rows = toImportRows(parsed, autoMap(parsed.headers));

    expect(rows.map((r) => [r.line, r.name, r.project_id, r.note])).toEqual([
      [2, 'GitHub', '', ''],
      [3, 'DB', AURORA._id, 'a, b'],
    ]);
  });

  it('only reads a project column headed exactly as Cloak exports it', () => {
    expect(projectColumn(['name', 'password', 'project'])).toBeNull();
    const parsed = parseCsv('name,password,project\nGitHub,pw,6aaa58719191fa378c31546e');
    expect(toImportRows(parsed, autoMap(parsed.headers))[0]!.project_id).toBe('');
  });

  it('ships a sample that imports cleanly', () => {
    const parsed = parseCsv(sampleCredsCsv(AURORA));
    const rows = toImportRows(parsed, autoMap(parsed.headers));
    expect(rows.map((r) => resolveProject(r.project_id, [AURORA]).kind)).toEqual(['none', 'linked']);
    expect(parseCsv(sampleCredsCsv()).rows.every((r) => r[5] === '')).toBe(true);
  });
});
