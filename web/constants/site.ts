export const SITE = {
  name: "Cloak",
  tagline: "Zero-knowledge secrets for developers",
  description:
    "Zero-knowledge secrets manager for developers. Native desktop vault for credentials, API keys, SSH keys, and encrypted .env files — plaintext never leaves your machine.",
  url: "https://cloak.app",
  repo: "https://github.com/yousuf-git/cloak",
  repoApi: "https://api.github.com/repos/yousuf-git/cloak",
  license: "MIT",
  author: "yousuf-git",
  authorName: "M. Yousuf",
  authorUrl: "https://yousuf-dev.com",
} as const;

// "/#anchor" (not "#anchor") so links resolve from subpages like /download.
export const NAV_LINKS = [
  { label: "Product", href: "/#product" },
  { label: "Features", href: "/#features" },
  { label: "Why Cloak", href: "/#why" },
  { label: "FAQ", href: "/#faq" },
  { label: "Download", href: "/download" },
] as const;

/**
 * Installer variants per platform, in priority order — the first variant with a
 * matching release asset is the default download. Matching is done variant-by-
 * variant (never by the release's asset order, which is nondeterministic).
 * Note: `.app.tar.gz` is the Tauri updater artifact, deliberately not offered.
 */
export const PLATFORMS = [
  {
    id: "windows",
    label: "Windows",
    icon: "windows",
    variants: [
      { id: "exe", label: "Installer (.exe)", pattern: /-setup\.exe$/i },
      { id: "msi", label: "MSI package (.msi)", pattern: /\.msi$/i },
    ],
  },
  {
    id: "macos",
    label: "macOS",
    icon: "apple",
    variants: [
      { id: "dmg", label: "Universal (.dmg) — Intel & Apple Silicon", pattern: /\.dmg$/i },
    ],
  },
  {
    id: "linux",
    label: "Linux",
    icon: "linux",
    variants: [
      { id: "appimage", label: "AppImage — portable, no install", pattern: /\.AppImage$/i },
      { id: "deb", label: "Debian / Ubuntu (.deb)", pattern: /\.deb$/i },
      { id: "rpm", label: "Fedora / openSUSE (.rpm)", pattern: /\.rpm$/i },
    ],
  },
] as const;

export type PlatformVariant = (typeof PLATFORMS)[number]["variants"][number];

export type PlatformId = (typeof PLATFORMS)[number]["id"];
