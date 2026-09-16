import { describe, it, expect } from 'vitest';
import { heldBack, planImport } from './cred-import';
import type { SourcedRow } from './csv-parse';

const AURORA = { _id: '6aaa58719191fa378c31546e', name: 'Aurora' };

function row(line: number, name: string, project_id = '', username = 'user'): SourcedRow {
  return { line, name, username, password: 'pw', url: '', note: '', project_id };
}

describe('planImport', () => {
  it('decides every row before anything is written', () => {
    const plans = planImport(
      [
        row(2, 'Standalone'),
        row(3, 'Linked', AURORA._id),
        row(4, 'Gone', '6aaa58719191fa378c31546f'),
        row(5, 'Garbled', 'Aurora'),
        row(6, 'Standalone'),
        row(7, 'Existing'),
      ],
      [{ name: 'existing', username: 'USER' }],
      [AURORA],
      true,
    ).map((p) => p.plan);

    expect(plans).toEqual([
      { status: 'ready', projectId: null, projectName: null },
      { status: 'ready', projectId: AURORA._id, projectName: 'Aurora' },
      { status: 'project_unknown', value: '6aaa58719191fa378c31546f' },
      { status: 'project_invalid', value: 'Aurora' },
      { status: 'duplicate', of: 2 },
      { status: 'duplicate', of: 'vault' },
    ]);
  });

  it('lets a corrected row through after one with a bad project was held back', () => {
    const plans = planImport(
      [row(2, 'DB', 'nope'), row(3, 'DB', AURORA._id)],
      [],
      [AURORA],
      true,
    ).map((p) => p.plan.status);
    expect(plans).toEqual(['project_invalid', 'ready']);
  });

  it('imports duplicates when asked not to skip them', () => {
    const plans = planImport([row(2, 'A'), row(3, 'A')], [{ name: 'A', username: 'user' }], [], false);
    expect(plans.every((p) => p.plan.status === 'ready')).toBe(true);
  });

  it('says what to do about a row it held back', () => {
    const [planned] = planImport([row(4, 'Gone', '6aaa58719191fa378c31546f')], [], [AURORA], true);
    expect(heldBack(planned!).detail).toContain('clear it to import this credential standalone');
  });
});
