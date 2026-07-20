export const SITE = {
  name: "Cloak",
  tagline: "Zero-knowledge secrets for developers",
  description:
    "Zero-knowledge secrets manager for developers. Native desktop vault for credentials, API keys, and encrypted .env files — plaintext never leaves your machine.",
  url: "https://cloak.app",
  repo: "https://github.com/yousuf-git/cloak",
  repoApi: "https://api.github.com/repos/yousuf-git/cloak",
  license: "MIT",
  author: "yousuf-git",
} as const;

export const NAV_LINKS = [
  { label: "Product", href: "#product" },
  { label: "Features", href: "#features" },
  { label: "Security", href: "#why" },
  { label: "FAQ", href: "#faq" },
  { label: "Download", href: "#download" },
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
