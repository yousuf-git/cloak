import { compareVersions } from './version';

const RELEASES_URL = 'https://api.github.com/repos/yousuf-git/cloak/releases?per_page=40';

/** The public page with every release and its server bundle. */
export const RELEASES_PAGE = 'https://github.com/yousuf-git/cloak/releases';

/** Where the installers are offered, for builds that cannot update themselves. */
export const DOWNLOAD_PAGE = 'https://cloak.commit4solutions.com/download';

export interface GitHubReleaseSummary {
  tag_name: string;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
}

export interface ServerRelease {
  version: string;
  url: string;
}

/**
 * The newest published server release. Server releases are tagged
 * `server-vX.Y.Z`; a bare `vX.Y.Z` predates the app and server being released
 * separately and shipped both.
 */
export function newestServerRelease(releases: GitHubReleaseSummary[]): ServerRelease | null {
  let newest: ServerRelease | null = null;
  for (const release of releases) {
    if (release.draft || release.prerelease) continue;
    const match = /^(?:server-)?v(\d+\.\d+\.\d+)$/.exec(release.tag_name);
    if (!match) continue;
    const version = match[1]!;
    if (!newest || compareVersions(version, newest.version) > 0) {
      newest = { version, url: release.html_url };
    }
  }
  return newest;
}

export async function fetchNewestServerRelease(): Promise<ServerRelease | null> {
  const res = await fetch(RELEASES_URL, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  return newestServerRelease((await res.json()) as GitHubReleaseSummary[]);
}
