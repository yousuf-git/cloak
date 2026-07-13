import {
  EyeOff,
  FileKey,
  FolderKanban,
  KeyRound,
  Lock,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface Feature {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const HERO = {
  headline: "The zero-knowledge secrets vault for developers",
  subhead:
    "Store credentials, API keys, and encrypted .env files in a native desktop app. Argon2id and XChaCha20-Poly1305 run on your machine — the server only stores ciphertext.",
  installCommand: "git clone https://github.com/yousuf-git/cloak.git && cd cloak && pnpm install",
} as const;

export const VALUE_PROPS = [
  {
    title: "Password managers miss developer workflows",
    body: "Most vaults handle logins. Few handle .env files, API keys, or dotenvx-encrypted configs — the secrets you touch every day.",
  },
  {
    title: "Cloud secret stores require trust",
    body: "Hosted managers hold keys that decrypt your data. A provider breach can become a secrets breach.",
  },
  {
    title: "Cloak keeps sync without surrendering keys",
    body: "Convenience of a cloud-backed vault. Guarantee that the server — and anyone who breaches it — only ever sees encrypted blobs.",
  },
] as const;

export const VAULT_MODULES = [
  "Credentials",
  "API Keys",
  "Environment Files",
  "Backup Codes",
  "Projects",
] as const;

export const FEATURES: Feature[] = [
  {
    title: "Zero-knowledge cryptography",
    description:
      "Argon2id KDF with domain separation. XChaCha20-Poly1305 field encryption. Envelope-encrypted Vault DEK. Keys in volatile memory only.",
    icon: Shield,
  },
  {
    title: "Five vault modules",
    description:
      "Credentials, API Keys, .env files, Backup Codes, and Projects — grouped the way your work is organized.",
    icon: FolderKanban,
  },
  {
    title: "dotenvx workflow",
    description:
      "Import plaintext or pre-encrypted .env files. Values encrypted per-field; the dotenvx key sealed with your master key.",
    icon: FileKey,
  },
  {
    title: "On-demand reveal",
    description:
      "Secrets show as masked ciphertext until you click reveal or copy. No bulk decryption on page load.",
    icon: EyeOff,
  },
  {
    title: "2FA and email verification",
    description:
      "Single-use OTP codes with time-boxed expiry, delivered via Resend.",
    icon: Lock,
  },
  {
    title: "Zero-knowledge recovery",
    description:
      "Recovery Key + email flow resets a lost master password without the server learning your secrets.",
    icon: RefreshCw,
  },
  {
    title: "30-day Remember Me",
    description:
      "Master key in OS secure store — Keychain, Credential Manager, or Secret Service via the keyring crate.",
    icon: KeyRound,
  },
  {
    title: "Sandbox mode",
    description:
      "Full app with dummy data. No account, no API. Try every workflow first.",
    icon: Sparkles,
  },
  {
    title: "Metadata search",
    description:
      "Filter names, labels, and tags instantly. Search never triggers bulk decryption.",
    icon: Search,
  },
];

export const ARCHITECTURE = {
  desktop: [
    { label: "React + TypeScript UI", detail: "Tauri webview" },
    { label: "Rust core", detail: "Argon2id · XChaCha20 · dotenvx" },
    { label: "Vault DEK", detail: "Volatile memory during session" },
  ],
  cloud: [
    { label: "Express API", detail: "Auth hash verification · JWT · rate limits" },
    { label: "MongoDB Atlas", detail: "Opaque ciphertext blobs only" },
  ],
  transport: "HTTPS — ciphertext and auth hashes only",
} as const;

export const DOTENVX_FLOW = [
  { input: "Plaintext .env value", step: "dotenvx encrypt", output: "Wrapped value block" },
  { input: "dotenvx private key", step: "Seal with master key", output: "Encrypted key token" },
] as const;

export const SECURITY_POINTS = [
  "Plaintext never leaves the device. Master key derived locally, held in volatile memory.",
  "Envelope encryption: Vault DEK wrapped by master key and recovery-wrapping key.",
  "No secrets in logs. Tokens, hashes, and payloads redacted from structured logs.",
  "Tiered rate limits and Helmet headers on the API. Auth attempts strictly capped.",
  "Metadata-only search — browsing never triggers bulk decryption.",
] as const;

export const TECH_STACK = [
  { layer: "Desktop shell", tech: "Tauri 2, Rust (2021 edition)" },
  { layer: "Rust crypto core", tech: "argon2, chacha20poly1305, dotenvx, zeroize, keyring" },
  { layer: "Frontend", tech: "React 19, TypeScript, Vite, Tailwind CSS v4" },
  { layer: "State & data", tech: "TanStack Query, Zustand, React Hook Form + Zod" },
  { layer: "Cloud API", tech: "Node.js ≥22, Express 5, Mongoose, MongoDB Atlas, Zod, Pino" },
  { layer: "Auth & email", tech: "JWT, Argon2id, Resend" },
  { layer: "Tooling", tech: "pnpm workspaces, Vitest, ESLint" },
] as const;

export const INSTALL_STEPS = [
  {
    title: "Clone and install",
    code: "git clone https://github.com/yousuf-git/cloak.git\ncd cloak\npnpm install",
  },
  {
    title: "Configure the API",
    code: "cp api/.env.example api/.env\n# MONGODB_URI, JWT_SECRET, REFRESH_SECRET (each ≥ 32 chars)",
  },
  {
    title: "Run in development",
    code: "pnpm dev:api\n# separate terminal:\npnpm --filter @cloak/desktop tauri:dev",
  },
  {
    title: "Build for production",
    code: "pnpm build:api\npnpm --filter @cloak/desktop tauri:build",
  },
] as const;

export const SCRIPTS = [
  { command: "pnpm dev:api", description: "API in watch mode" },
  { command: "pnpm dev:desktop", description: "Desktop UI in browser (Sandbox available)" },
  { command: "pnpm build:api", description: "Compile API to dist/" },
  { command: "pnpm --filter @cloak/desktop tauri:build", description: "Native desktop bundle" },
  { command: "pnpm test", description: "All workspace tests" },
  { command: "pnpm typecheck", description: "Type-check every package" },
] as const;

export const PREREQUISITES = [
  "Node.js ≥ 22, pnpm 10.33",
  "Rust ≥ 1.77 (rustup)",
  "MongoDB local or Atlas",
  "Tauri platform deps for your OS",
] as const;

export const FAQ_ITEMS = [
  {
    question: "What does zero-knowledge mean here?",
    answer:
      "Master password and plaintext secrets never leave your machine. Keys derived with Argon2id locally. Secrets sealed with XChaCha20-Poly1305 before any network request. The API stores ciphertext it cannot decrypt.",
  },
  {
    question: "Which platforms are supported?",
    answer:
      "Windows, macOS, and Linux via Tauri 2. Build with pnpm --filter @cloak/desktop tauri:build on each platform.",
  },
  {
    question: "Can I try it without the API?",
    answer:
      "Yes. pnpm dev:desktop runs the UI in a browser. Use Sandbox mode for dummy data — no account required.",
  },
  {
    question: "How does .env encryption work?",
    answer:
      "dotenvx encrypts each value. The dotenvx private key is sealed with your master key. Both blob and sealed key sync as opaque server-side data.",
  },
  {
    question: "Has Cloak been audited?",
    answer:
      "No independent security audit yet. Review the threat model in the repository before production use.",
  },
  {
    question: "License?",
    answer: "MIT. Inspect, modify, and contribute on GitHub.",
  },
] as const;

export const TERMINAL_LINES = [
  { type: "prompt" as const, text: "$ git clone https://github.com/yousuf-git/cloak.git" },
  { type: "output" as const, text: "Cloning into 'cloak'..." },
  { type: "prompt" as const, text: "$ cd cloak && pnpm install" },
  { type: "output" as const, text: "Scope: all 2 workspace projects" },
  { type: "prompt" as const, text: "$ pnpm --filter @cloak/desktop tauri:dev" },
  { type: "output" as const, text: "Cloak · Vite on http://localhost:1420" },
  { type: "prompt" as const, text: "$ pnpm --filter @cloak/desktop tauri:build" },
  { type: "output" as const, text: "Bundle: app.cloak.desktop (Windows · macOS · Linux)" },
] as const;

export const COMPARISON_ROWS = [
  { feature: "Zero-knowledge encryption", cloak: true, passwordManagers: "Partial", cloudStores: false },
  { feature: ".env / dotenvx workflow", cloak: true, passwordManagers: false, cloudStores: "Partial" },
  { feature: "Native desktop (Tauri)", cloak: true, passwordManagers: "Partial", cloudStores: false },
  { feature: "On-demand field reveal", cloak: true, passwordManagers: true, cloudStores: "Varies" },
  { feature: "Open source (MIT)", cloak: true, passwordManagers: "Partial", cloudStores: false },
  { feature: "OS secure-store Remember Me", cloak: true, passwordManagers: true, cloudStores: false },
] as const;

export const DEV_COMMANDS = `pnpm dev:api
# separate terminal:
pnpm --filter @cloak/desktop tauri:dev
# browser preview + Sandbox (no API):
pnpm dev:desktop`;
