import { describe, it, expect } from 'vitest';
import { compareVersions, isOlder } from './version';
import { newestServerRelease, type GitHubReleaseSummary } from './releases';

describe('compareVersions', () => {
  it('orders by number, not by text', () => {
    expect(compareVersions('0.10.0', '0.9.9')).toBe(1);
    expect(compareVersions('v1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(isOlder('0.2.0', '0.3.0')).toBe(true);
    expect(isOlder('0.3.0', '0.3.0')).toBe(false);
  });
});

describe('newestServerRelease', () => {
  const release = (tag_name: string, extra: Partial<GitHubReleaseSummary> = {}) => ({
    tag_name,
    html_url: `https://example.test/${tag_name}`,
    draft: false,
    prerelease: false,
    ...extra,
  });

  it('reads server tags and the older combined tags, and ignores app releases', () => {
    expect(
      newestServerRelease([
        release('desktop-v0.9.0'),
        release('server-v0.4.1'),
        release('v0.3.0'),
        release('server-v0.5.0', { draft: true }),
      ]),
    ).toEqual({ version: '0.4.1', url: 'https://example.test/server-v0.4.1' });
    expect(newestServerRelease([release('v0.3.0'), release('v0.2.0')])?.version).toBe('0.3.0');
    expect(newestServerRelease([release('desktop-v1.0.0')])).toBeNull();
  });
});
