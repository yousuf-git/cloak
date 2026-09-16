import { describe, it, expect } from 'vitest';
import { auditParams, isFiltered, NO_FILTERS } from './audit-filters';
import { pageRange, pageWindow } from './pagination';

describe('pageWindow', () => {
  it('lists every page when there are few', () => {
    expect(pageWindow(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps both ends and the neighbourhood of the current page', () => {
    expect(pageWindow(10, 20)).toEqual([1, 'gap', 9, 10, 11, 'gap', 20]);
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, 4, 'gap', 20]);
    expect(pageWindow(20, 20)).toEqual([1, 'gap', 17, 18, 19, 20]);
  });
});

describe('pageRange', () => {
  it('describes the rows on a page, including a short last page', () => {
    expect(pageRange(2, 20, 312)).toEqual({ from: 21, to: 40 });
    expect(pageRange(16, 20, 312)).toEqual({ from: 301, to: 312 });
    expect(pageRange(1, 20, 0)).toEqual({ from: 0, to: 0 });
  });
});

describe('auditParams', () => {
  it('sends only the filters that are set', () => {
    expect(auditParams(NO_FILTERS, 0)).toEqual({});
    expect(isFiltered(NO_FILTERS)).toBe(false);
  });

  it('turns a time range into a start date relative to the moment asked', () => {
    const now = Date.UTC(2026, 8, 16, 12);
    expect(
      auditParams({ ...NO_FILTERS, q: '  stripe ', area: 'cred', outcome: 'failure', range: '24h' }, now),
    ).toEqual({ q: 'stripe', area: 'cred', outcome: 'failure', from: '2026-09-15T12:00:00.000Z' });
  });
});
