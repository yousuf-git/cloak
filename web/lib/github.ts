import { PLATFORMS, SITE } from "@/constants/site";
import type {
  GitHubData,
  GitHubRelease,
  GitHubRepoStats,
  PlatformId,
} from "@/types/github";

const REVALIDATE_SECONDS = 3600;

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "cloak-marketing-site",
      },
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

interface RawRepo {
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  license: { spdx_id: string } | null;
  default_branch: string;
  pushed_at: string;
  description: string | null;
}

interface RawRelease {
  tag_name: string;
  name: string;
  published_at: string;
  body: string;
  html_url: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
    content_type: string;
  }>;
}

function mapRepo(raw: RawRepo): GitHubRepoStats {
  return {
    stars: raw.stargazers_count,
    forks: raw.forks_count,
    openIssues: raw.open_issues_count,
    license: raw.license?.spdx_id ?? null,
    defaultBranch: raw.default_branch,
    pushedAt: raw.pushed_at,
    description: raw.description,
  };
}

function mapRelease(raw: RawRelease): GitHubRelease {
  return {
    tagName: raw.tag_name,
    name: raw.name,
    publishedAt: raw.published_at,
    body: raw.body,
    htmlUrl: raw.html_url,
    assets: raw.assets.map((asset) => ({
      name: asset.name,
      browserDownloadUrl: asset.browser_download_url,
      size: asset.size,
      contentType: asset.content_type,
    })),
  };
}

export async function getGitHubData(): Promise<GitHubData> {
  const [repoRaw, releasesRaw] = await Promise.all([
    fetchJson<RawRepo>(SITE.repoApi),
    fetchJson<RawRelease[]>(`${SITE.repoApi}/releases?per_page=1`),
  ]);

  return {
    repo: repoRaw ? mapRepo(repoRaw) : null,
    latestRelease:
      releasesRaw && releasesRaw.length > 0 ? mapRelease(releasesRaw[0]) : null,
    fetchedAt: new Date().toISOString(),
  };
}

export function detectPlatform(userAgent: string): PlatformId {
  const ua = userAgent.toLowerCase();

  if (ua.includes("win")) return "windows";
  if (ua.includes("mac") || ua.includes("darwin")) return "macos";
  if (ua.includes("linux") || ua.includes("x11")) return "linux";

  return "unknown";
}

export function findAssetForPlatform(
  release: GitHubRelease | null,
  platform: PlatformId,
) {
  if (!release || platform === "unknown") return null;

  const config = PLATFORMS.find((item) => item.id === platform);
  if (!config) return null;

  return (
    release.assets.find((asset) => config.assetPattern.test(asset.name)) ?? null
  );
}

export function getDownloadUrl(
  release: GitHubRelease | null,
  platform: PlatformId,
): { url: string; filename: string | null; isSourceBuild: boolean } {
  const asset = findAssetForPlatform(release, platform);

  if (asset) {
    return {
      url: asset.browserDownloadUrl,
      filename: asset.name,
      isSourceBuild: false,
    };
  }

  return {
    url: `${SITE.repo}#getting-started`,
    filename: null,
    isSourceBuild: true,
  };
}

export function getPlatformLabel(platform: PlatformId): string {
  const match = PLATFORMS.find((item) => item.id === platform);
  return match?.label ?? "your platform";
}
