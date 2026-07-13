export interface GitHubRepoStats {
  stars: number;
  forks: number;
  openIssues: number;
  license: string | null;
  defaultBranch: string;
  pushedAt: string;
  description: string | null;
}

export interface GitHubReleaseAsset {
  name: string;
  browserDownloadUrl: string;
  size: number;
  contentType: string;
}

export interface GitHubRelease {
  tagName: string;
  name: string;
  publishedAt: string;
  body: string;
  assets: GitHubReleaseAsset[];
  htmlUrl: string;
}

export interface GitHubData {
  repo: GitHubRepoStats | null;
  latestRelease: GitHubRelease | null;
  fetchedAt: string;
}

export type PlatformId = "windows" | "macos" | "linux" | "unknown";

export interface DownloadTarget {
  platform: PlatformId;
  label: string;
  url: string;
  filename: string | null;
  isSourceBuild: boolean;
}
