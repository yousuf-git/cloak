export const SITE = {
  name: "Cloak",
  tagline: "Zero-knowledge secrets for developers",
  description:
    "A zero-knowledge, developer-centric secrets manager and password vault — built as a native desktop app. Your master password and plaintext secrets never leave your machine.",
  url: "https://cloak.app",
  repo: "https://github.com/yousuf-git/cloak",
  repoApi: "https://api.github.com/repos/yousuf-git/cloak",
  license: "MIT",
  author: "yousuf-git",
} as const;

export const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Architecture", href: "#architecture" },
  { label: "Security", href: "#security" },
  { label: "Docs", href: `${SITE.repo}#getting-started` },
] as const;

export const PLATFORMS = [
  {
    id: "windows",
    label: "Windows",
    icon: "windows",
    assetPattern: /\.msi$|\.exe$|windows/i,
  },
  {
    id: "macos",
    label: "macOS",
    icon: "apple",
    assetPattern: /\.dmg$|\.app\.tar\.gz$|macos|darwin/i,
  },
  {
    id: "linux",
    label: "Linux",
    icon: "linux",
    assetPattern: /\.AppImage$|\.deb$|\.rpm$|linux/i,
  },
] as const;

export type PlatformId = (typeof PLATFORMS)[number]["id"];
