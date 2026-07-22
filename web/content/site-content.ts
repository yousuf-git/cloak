export const HERO = {
  brand: "Cloak",
  headline: "Secrets that never leave your machine.",
  subhead:
    "A zero-knowledge desktop vault for credentials, API keys, SSH keys, and encrypted .env files. Sync convenience. Local cryptography. Opaque cloud storage.",
} as const;

export const TRUST_LINE = "Native for Windows, macOS, and Linux · MIT open source" as const;

export const SOCIAL_PROOF = {
  label: "Built for the stack you already trust",
  // `icon` keys into the map in social-proof.tsx (brand marks + lucide glyphs
  // for the crypto primitives, which have no brand).
  logos: [
    { icon: "tauri", label: "Tauri 2" },
    { icon: "rust", label: "Rust" },
    { icon: "react", label: "React 19" },
    { icon: "argon2", label: "Argon2id" },
    { icon: "xchacha", label: "XChaCha20" },
    { icon: "dotenv", label: "dotenvx" },
  ],
} as const;

export const PRODUCT_EXPERIENCE = {
  label: "Product",
  title: "One vault. Seven modules. Zero plaintext on the wire.",
  body: "Cloak unifies everyday credentials with developer workflows — encrypted .env management, cloud access keys, SSH key files — behind a fast, native interface.",
  points: [
    {
      title: "Credentials & API keys",
      body: "Store logins and tokens the way you work. Masked by default. Revealed on demand, per field.",
    },
    {
      title: "Access & SSH keys",
      body: "AWS-style key pairs — typed in or imported from a credentials CSV — plus RSA/ED25519 key files in PEM or PuTTY format, detected on import.",
    },
    {
      title: "Environment files",
      body: "Import plaintext or dotenvx-encrypted configs. Values sealed client-side; keys wrapped with your master key.",
    },
    {
      title: "Projects & backup codes",
      body: "Group secrets by project. Keep recovery codes organized without scattering them across notes apps.",
    },
  ],
} as const;

export const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Derive locally",
    body: "Your master password feeds Argon2id on-device. Keys live only in volatile memory for the session.",
  },
  {
    step: "02",
    title: "Seal before sync",
    body: "XChaCha20-Poly1305 encrypts every secret before anything touches the network.",
  },
  {
    step: "03",
    title: "Store ciphertext",
    body: "The API holds opaque blobs and auth hashes. It has nothing to decrypt — by design.",
  },
  {
    step: "04",
    title: "Reveal on demand",
    body: "Browse metadata freely. Decrypt only the field you reveal or copy — never bulk on load.",
  },
] as const;

export const FEATURE_BLOCKS = [
  {
    id: "crypto",
    label: "Cryptography",
    title: "Envelope encryption, not hope.",
    body: "A per-user Vault DEK is wrapped by your master key — and by a recovery-wrapping key — so resets re-wrap without exposing data.",
    detail: "Argon2id · XChaCha20-Poly1305 · domain-separated KDFs",
  },
  {
    id: "dotenvx",
    label: "Developer workflow",
    title: ".env files that understand encryption.",
    body: "Import plaintext or already-encrypted dotenvx files. View, decrypt, edit, and delete — with the private key sealed under your master key.",
    detail: "Per-value encryption · wrapped key token · opaque sync",
  },
  {
    id: "reveal",
    label: "Exposure model",
    title: "Masked until you mean it.",
    body: "Secrets render as truncated ciphertext by default. Reveal and copy decrypt a single field in real time — conveying that decryption is intentional.",
    detail: "No bulk decrypt on browse · metadata-only search",
  },
  {
    id: "recovery",
    label: "Account recovery",
    title: "Recover without surrendering knowledge.",
    body: "A Recovery Key plus email flow lets you reset a lost master password. The server never learns your secrets — only new wrapped keys.",
    detail: "Zero-knowledge recovery · OS secure-store Remember Me",
  },
] as const;

export type WhyMark = "yes" | "partial" | "no";

/** Comparison matrix: each row's `marks` align with `columns`; Cloak is an
 *  implicit final column that has every feature. */
export const WHY_MATRIX = {
  columns: ["Password managers", "Cloud secret stores", "Notes & .env in git"],
  rows: [
    { feature: "Zero-knowledge, client-side encryption", marks: ["yes", "no", "no"] },
    { feature: "Encrypted .env files (dotenvx-compatible)", marks: ["no", "partial", "no"] },
    { feature: "API keys, access keys & SSH key files", marks: ["partial", "partial", "no"] },
    { feature: "2FA backup codes, organized per platform", marks: ["partial", "no", "no"] },
    { feature: "Field-level reveal — one secret at a time", marks: ["partial", "no", "no"] },
    { feature: "Native desktop app for Windows, macOS, Linux", marks: ["yes", "no", "no"] },
    { feature: "Free & MIT open source", marks: ["partial", "no", "yes"] },
  ],
} as const satisfies {
  columns: readonly string[];
  rows: readonly { feature: string; marks: readonly WhyMark[] }[];
};

export const TESTIMONIALS = [
  {
    quote:
      "I needed something that understood .env files the way I understand them — encrypted at rest, sealed before sync, never plaintext in the cloud.",
    name: "A. Rahman",
    role: "Staff engineer",
  },
  {
    quote:
      "The reveal model is the point. You feel the decryption. That alone changes how carefully you treat secrets.",
    name: "M. Chen",
    role: "Security-minded developer",
  },
  {
    quote:
      "Sandbox mode sold me. Full UI, dummy data, no account — then I built from source when I was ready.",
    name: "J. Okonkwo",
    role: "Indie hacker",
  },
] as const;

export const STATS = [
  { value: 0, suffix: "", label: "plaintext secrets on the server", display: "0" },
  { value: 7, suffix: "", label: "vault modules in one native app", display: "7" },
  { value: 3, suffix: "", label: "platforms — Windows, macOS, Linux", display: "3" },
  { value: 30, suffix: "-day", label: "Remember Me via OS secure store", display: "30" },
] as const;

export const SHOWCASE = [
  {
    title: "Vault overview",
    body: "Projects, modules, and search over non-encrypted metadata — without waking sealed fields.",
  },
  {
    title: "Field-level reveal",
    body: "Click to decrypt. Copy to clipboard. Everything else stays masked.",
  },
  {
    title: "dotenvx import",
    body: "Bring encrypted configs in. Keep the private key wrapped under your master key.",
  },
] as const;

export const FAQ_ITEMS = [
  {
    question: "What does zero-knowledge mean here?",
    answer:
      "Your master password and plaintext secrets never leave the device. Keys are derived with Argon2id locally; secrets are sealed with XChaCha20-Poly1305 before any network request. The API stores ciphertext it cannot decrypt.",
  },
  {
    question: "Which platforms are supported?",
    answer:
      "Windows, macOS, and Linux via Tauri 2. Build with pnpm --filter @cloak/desktop tauri:build on each platform.",
  },
  {
    question: "Can I try it without the API?",
    answer:
      "Yes. pnpm dev:desktop runs the UI in a browser. Sandbox mode uses dummy data — no account required.",
  },
  {
    question: "How does .env encryption work?",
    answer:
      "dotenvx encrypts each value. The dotenvx private key is sealed with your master key. Both the blob and sealed key sync as opaque server-side data.",
  },
  {
    question: "Has Cloak been audited?",
    answer:
      "No independent security audit yet. Review the threat model in the repository before production use.",
  },
  {
    question: "What is the license?",
    answer: "MIT. Inspect, modify, and contribute on GitHub.",
  },
] as const;

export const FINAL_CTA = {
  title: "Your secrets stay yours.",
  body: "Download the native app, explore Sandbox, or build from source. Cryptography happens on your machine — every time.",
} as const;

export const VAULT_MODULES = [
  "Credentials",
  "API Keys",
  "Access Keys",
  "SSH Keys",
  "Environment Files",
  "Backup Codes",
  "Projects",
] as const;
