<div align="center">

<img src="./.github/assets/logo.svg" width="112" height="112" alt="Cloak logo" />

# Cloak

**A zero-knowledge, developer-centric secrets manager and password vault — built as a native desktop app.**

Your master password and plaintext secrets never leave your machine. Everything is encrypted on-device before it ever touches the network.

<br/>

![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?style=flat-square&logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-19-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5%2B-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-core-000000?style=flat-square&logo=rust&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A522-5FA04E?style=flat-square&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-3FB950?style=flat-square)

</div>

---

## <img src="https://api.iconify.design/lucide/eye-off.svg?color=%236366f1&height=20" align="center" alt="" /> Overview

**Cloak** is a desktop vault that unifies everyday credential storage with modern developer workflows — most notably encrypted `.env` file management — behind a fast, native-feeling interface.

It is built around a strict **zero-knowledge** contract: all master cryptographic keys are derived locally with Argon2id, secrets are sealed with XChaCha20-Poly1305 before leaving the device, and the cloud API stores only opaque ciphertext it can never read. Secrets are masked by default and revealed strictly on demand, per field.

**What problem it solves**

- Password managers rarely understand developer secrets (`.env` files, API keys, dotenvx-encrypted configs).
- Cloud secret stores require trusting the provider with plaintext.

Cloak keeps the convenience of a synced vault while guaranteeing the server — and anyone who breaches it — only ever sees encrypted blobs.

## <img src="https://api.iconify.design/lucide/list-checks.svg?color=%236366f1&height=20" align="center" alt="" /> Features

- **Zero-knowledge cryptography** — Argon2id key derivation with domain separation, XChaCha20-Poly1305 field encryption, and envelope encryption of a per-user Vault DEK. Keys live only in volatile memory during a session.
- **Five vault modules** — Credentials, API Keys, Environment Files (`.env`), Backup Codes, and Projects to group them.
- **dotenvx `.env` workflow** — import plaintext or already-encrypted files, then view, decrypt, edit, and delete. Encrypted content is stored server-side as an opaque blob; the dotenvx key is wrapped with your master key.
- **On-demand exposure** — secrets render as truncated ciphertext by default and are decrypted only when you click reveal/copy, conveying real-time decryption.
- **Two-factor auth & email verification** — single-use, time-boxed OTP codes delivered via professionally branded email templates (Resend).
- **Zero-knowledge account recovery** — a Recovery Key + email flow lets you reset a lost master password without the server ever learning your secrets.
- **30-day "Remember Me"** — the master key is provisioned to the OS secure store (macOS Keychain, Windows Credential Manager, Linux Secret Service) via the `keyring` crate.
- **Sandbox mode** — explore the entire app with realistic dummy data, no account required.
- **Functional search & theming** — instant filtering over non-encrypted metadata, plus system/light/dark themes.

## <img src="https://api.iconify.design/lucide/workflow.svg?color=%236366f1&height=20" align="center" alt="" /> How it works

Cloak splits responsibilities between an on-device Rust core (all cryptography) and a thin cloud API (opaque storage + auth orchestration).

```
        ┌─────────────────────────────── Desktop App (Tauri) ───────────────────────────────┐
        │                                                                                    │
        │   React + TypeScript UI  ──invoke──►  Rust core (Argon2id · XChaCha20 · dotenvx)    │
        │        │  masked secrets, reveal on demand        │  Vault DEK in volatile memory   │
        └────────┼───────────────────────────────────────────┼───────────────────────────────┘
                 │ HTTPS (only ciphertext + auth hashes)      │ OS secure store (Remember-Me)
                 ▼                                            (Keychain / Cred Mgr / Secret Service)
        ┌──────────────────────────── Cloud API (Node · Express) ────────────────────────────┐
        │   Verifies auth hash · issues JWTs · rate limits · never decrypts payloads           │
        │                              MongoDB Atlas (opaque blobs)                            │
        └──────────────────────────────────────────────────────────────────────────────────┘
```

**Environment file encryption (dotenvx)** — values are encrypted individually, and the private key that unlocks them is itself sealed with your master key:

```
[ Plaintext .env value ] ──► encrypted via dotenvx ──► [ Wrapped value block ]
                                       │
[ Raw dotenvx private key ] ──► sealed with Master Key ──► [ Encrypted key token ]
                                       │
                    Both the encrypted blob and the sealed key are stored server-side.
```

## <img src="https://api.iconify.design/lucide/layers.svg?color=%236366f1&height=20" align="center" alt="" /> Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Desktop shell** | Tauri 2, Rust (2021 edition) |
| **Rust crypto core** | `argon2`, `chacha20poly1305`, `dotenvx`, `zeroize`, `keyring` |
| **Frontend** | React 19 (compiler), TypeScript, Vite, Tailwind CSS v4 |
| **State & data** | TanStack Query, Zustand, React Hook Form + Zod, Framer Motion |
| **Cloud API** | Node.js (≥22), Express 5, Mongoose / MongoDB Atlas, Zod, Pino |
| **Auth & email** | JWT (access + rotating refresh), Argon2id, Resend |
| **Tooling** | pnpm workspaces, Vitest, ESLint |

## <img src="https://api.iconify.design/lucide/folder-tree.svg?color=%236366f1&height=20" align="center" alt="" /> Project Structure

```
cloak/
├── api/                     # Cloud backend (Node + Express + MongoDB)
│   ├── src/
│   │   ├── config/          # Zod-validated environment config
│   │   ├── controllers/     # Auth + vault request handlers
│   │   ├── services/        # Auth, vault, env-file, email, token, audit logic
│   │   ├── models/          # Mongoose schemas (user, cred, api-key, env-file, …)
│   │   ├── middlewares/     # Rate limiting, auth guard, logging, error handling
│   │   ├── routes/          # Versioned API routes (/api/v1)
│   │   └── lib/             # jwt, hashing, logger, email-templates, errors
│   └── tests/               # Vitest + Supertest integration tests
│
└── desktop/                 # Tauri desktop application
    ├── src/                 # React + TypeScript UI
    │   ├── pages/           # Credentials, API keys, Env files, Backup codes, Projects, Settings
    │   ├── components/      # Auth flows, vault UI, shared primitives
    │   ├── hooks/ stores/   # Data hooks + Zustand stores (auth, sandbox, search, theme)
    │   └── lib/             # API client, tauri-crypto bridge, env parser
    └── src-tauri/           # Rust core
        └── src/
            ├── crypto/      # kdf, aead, dek, dotenvx_compat
            ├── commands/    # Tauri commands exposed to the webview
            ├── keystore/    # OS secure-store (Remember-Me)
            └── session/     # In-memory session + Vault DEK
```

## <img src="https://api.iconify.design/lucide/rocket.svg?color=%236366f1&height=20" align="center" alt="" /> Getting Started

### Prerequisites

- **Node.js** ≥ 22 and **pnpm** 10.33 (`corepack enable`)
- **Rust** toolchain ≥ 1.77 (via [rustup](https://rustup.rs))
- **MongoDB** running locally or a MongoDB Atlas connection string
- Tauri platform dependencies for your OS — see the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/)

### Installation

```bash
git clone https://github.com/yousuf-git/cloak.git
cd cloak
pnpm install
```

### Configure the API

```bash
cp api/.env.example api/.env
```

Then set at least `MONGODB_URI`, `JWT_SECRET`, and `REFRESH_SECRET` (each ≥ 32 characters). See the **Configuration** section below for the full list.

### Run in development

```bash
# Terminal 1 — cloud API (http://localhost:4000)
pnpm dev:api

# Terminal 2 — desktop app (Tauri window + Vite on http://localhost:1420)
pnpm --filter @cloak/desktop tauri:dev
```

> Prefer a quick look without native tooling? `pnpm dev:desktop` runs the UI in the browser, and the in-app **Sandbox** button lets you explore with dummy data — no API or account needed.

### Build for production

```bash
pnpm build:api                              # compile the API to dist/
pnpm --filter @cloak/desktop tauri:build    # produce a native desktop bundle
```

## <img src="https://api.iconify.design/lucide/sliders-horizontal.svg?color=%236366f1&height=20" align="center" alt="" /> Configuration

API configuration is validated at boot with Zod (`api/src/config/index.ts`) — the server refuses to start on invalid config.

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `NODE_ENV` | – | `development` | `development` \| `test` \| `production` |
| `PORT` | – | `4000` | API listen port |
| `MONGODB_URI` | **Yes** | – | MongoDB connection string |
| `JWT_SECRET` | **Yes** | – | Access-token signing secret (≥ 32 chars) |
| `REFRESH_SECRET` | **Yes** | – | Refresh-token signing secret (≥ 32 chars) |
| `ACCESS_TOKEN_TTL` | – | `15m` | Access-token lifetime |
| `REFRESH_TOKEN_TTL` | – | `30d` | Refresh-token lifetime |
| `OTP_TTL_SECONDS` | – | `600` | One-time code lifetime (seconds) |
| `RATE_LIMIT_WINDOW_MS` | – | `900000` | Rate-limit window (15 min) |
| `RATE_LIMIT_AUTH_MAX` | – | `5` | Max auth attempts per window |
| `RATE_LIMIT_API_MAX` | – | `100` | Max API requests per window |
| `RATE_LIMIT_UPLOAD_MAX` | – | `20` | Max uploads per window |
| `CORS_ORIGIN` | – | `*` | Allowed origin(s), comma-separated |
| `LOG_LEVEL` | – | `info` | Pino log level |
| `RESEND_API_KEY` | – | – | Enables real email delivery (else logged to console) |
| `RESEND_FROM_EMAIL` | – | – | Verified sender address for Resend |

## <img src="https://api.iconify.design/lucide/terminal.svg?color=%236366f1&height=20" align="center" alt="" /> Scripts

Run from the repository root:

| Command | Description |
|---------|-------------|
| `pnpm dev:api` | Start the API in watch mode |
| `pnpm dev:desktop` | Start the desktop UI (browser preview) |
| `pnpm build:api` | Compile the API to `dist/` |
| `pnpm build:desktop` | Build the desktop frontend |
| `pnpm test` | Run all workspace tests |
| `pnpm typecheck` | Type-check every package |
| `pnpm lint` | Lint every package |

Desktop-only: `pnpm --filter @cloak/desktop tauri:dev` and `… tauri:build`.

## <img src="https://api.iconify.design/lucide/flask-conical.svg?color=%236366f1&height=20" align="center" alt="" /> Testing

The API ships with Vitest + Supertest integration tests covering health, authentication/recovery, and vault CRUD.

```bash
pnpm --filter @cloak/api test     # API integration suite
pnpm test                         # all workspaces
```

## <img src="https://api.iconify.design/lucide/shield-check.svg?color=%236366f1&height=20" align="center" alt="" /> Security Model

- **Plaintext never leaves the device.** The master key is derived locally and held only in volatile memory; the server stores opaque ciphertext and authentication hashes.
- **Envelope encryption.** A per-user Vault DEK is wrapped by the master key (and by a recovery-wrapping key), so a password reset re-wraps keys without exposing data.
- **No secrets in logs.** Structured logging redacts tokens, hashes, and secret payloads; request logs are trimmed to method/URL/status.
- **Hardened transport & rate limits.** Tiered `express-rate-limit` windows and Helmet headers guard the API; auth attempts are strictly capped.
- **Metadata-only search.** Search filters non-encrypted fields (names, labels, tags) so browsing never triggers bulk decryption.

> Cloak is under active development and has not undergone an independent security audit. Review the threat model before using it for production secrets.

## <img src="https://api.iconify.design/lucide/scale.svg?color=%236366f1&height=20" align="center" alt="" /> License

Released under the [MIT License](./LICENSE).
