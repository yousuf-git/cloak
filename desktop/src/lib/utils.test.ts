import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime } from './utils';

describe('timestamps', () => {
  // Built from local fields, so the expectation holds in whatever zone the tests run.
  const local = new Date(2026, 8, 16, 21, 5).toISOString();

  it("shows a UTC timestamp in the viewer's timezone", () => {
    // ICU versions differ on "Sep" versus "Sept".
    expect(formatDateTime(local)).toMatch(/^16 Sept? 2026, 09:05 PM$/);
    expect(formatDate(local)).toMatch(/^16 Sept? 2026$/);
  });

  it('shows a dash for a missing or unreadable timestamp', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDate('not a date')).toBe('—');
  });
});
