# Cloak — Development Plan

> A zero-knowledge, developer-centric secrets manager and password vault, delivered as a
> cross-platform desktop application (Tauri) backed by a thin Node.js/Express cloud gateway.
>
> This plan is derived strictly from `docs/prd.md`, `docs/idea.md`, `docs/raw-er.txt`,
> `docs/env-validation-rules.md`, the sketches in `docs/sketches/`, and the decisions locked in
> below. Nothing here is assumed silently — every non-PRD choice is listed under
> [§2 Locked Decisions](#2-locked-decisions) or [§3 Working Decisions](#3-working-decisions-correctable).

---

## 1. Product Summary

Cloak stores four categories of secrets for a single authenticated user, plus a fifth grouping
construct (platforms owning backup codes):

1. **User Credentials & Logins** — `name / url / username / password / note`.
2. **Environment Files (`.env`)** — per-project, multi-file, dotenvx-compatible encryption.
3. **Backup Codes** — grouped under a platform, each individually markable as used.
4. **API Keys & Secrets** — `label / url / key / note`, standalone or attached to a project.
5. **Projects** — organizational parent for env files and (optionally) credentials/keys.

Non-negotiable principles (from PRD Core Philosophy):
- **Zero-Knowledge:** the server never receives the master password or any plaintext secret.
- **On-Demand Exposure:** secrets render masked; reveal/copy are explicit per-field, except env files, which are revealed all at once, bcz we are not storing field-wise encrypted values in the database.
- **Volatile plaintext:** decrypted values, clipboard buffers, and dotenvx private keys live only
  in transient memory and are never written to disk or logs.

### 1.1 UI/UX Expectations (design contract)

The desktop experience is a first-class requirement, not a wrapper around a web page.

- **Framed, centered window.** Launches centered on the primary display in a fixed rectangular
  frame with sensible min/default sizes; not maximized, not full-bleed. Window is resizable within
  bounds.
- **Responsive & adaptive.** Layout adapts fluidly across the allowed window sizes (panels collapse,
  grids reflow); usable from the minimum size upward.
- **Clean & modern.** Restrained, confident visual language — clear hierarchy, generous spacing,
  consistent iconography (Lucide), a deliberate type scale, and light/dark themes.
- **Native desktop feel, not "web".** No browser chrome cues, no page-scroll jank, no link-blue
  defaults. Use app-shell layout (sidebar + content), custom/native-styled titlebar,
  desktop-grade context menus, keyboard shortcuts, and OS-appropriate motion. Content areas scroll
  internally, the shell stays put.
- **Crafted moments.** An animated loading/splash screen, a clean multi-step onboarding, and clear
  inline instructions/empty-states everywhere. Motion is purposeful (Framer Motion for UI
  transitions; GSAP reserved for splash/onboarding set-pieces) and respects `prefers-reduced-motion`.
- **Professional polish bar.** Every screen has considered loading, empty, error, and success
  states; focus-visible rings; full keyboard operability; and no layout shift on data load.

These expectations are threaded through Phase 0 (window config + app shell + design tokens),
Phase 2 (onboarding/login motion), and Phase 6 (polish pass), and are a gating part of each phase's
acceptance criteria.

---

## 2. Locked Decisions

These were explicitly confirmed and are treated as requirements.

| Area | Decision |
|------|----------|
| **Server auth model** | Client hashes the master password locally (Argon2id, dedicated auth context) and sends **only the auth hash** to the server for signup and login. The password never leaves the desktop app in plaintext. |
| **Crypto location** | All Master-Key encryption/decryption runs in the **Rust/Tauri core**. The Master Key is persisted on-device (OS secure storage) and loaded into Rust memory only when needed; it is never exposed to the webview as raw bytes. |
| **Symmetric cipher** | **XChaCha20-Poly1305** (AEAD) for all Master-Key field/blob encryption. |
| **`.env` encryption** | **Native Rust** ECIES over `secp256k1`, producing output that remains **dotenvx-decryptable** (dotenvx wire-format compatible). No Node/dotenvx sidecar. |
| **`.env` blob storage** | Encrypted `.env` blobs are uploaded to **Cloudinary**; MongoDB stores only the `path`/reference. |
| **Scope** | **Full PRD**, delivered in sequential phases (foundation → polish). |
| **In-scope for v1** | Google Password Manager CSV import, vault/credential export, Email OTP 2FA (Resend), 30-day OS-keychain Remember-Me, and the dotenv-parse/envalid validation UX (with skip). |
| **Target platforms** | **Linux, Windows, macOS** (dev machine is Linux). |

---

## 3. Working Decisions (correctable)

Choices required to write a buildable plan that the PRD did not pin down. Each is a reasonable
default; flag any you want changed.

1. **Key hierarchy (envelope encryption).** A random per-user **Vault Data-Encryption Key (DEK)**
   (256-bit) actually encrypts all field values. The DEK is wrapped by the Master Key and stored
   (wrapped) server-side. Rationale: master-password rotation and Remember-Me re-provisioning never
   require re-encrypting the whole vault. If you prefer encrypting directly with the Master Key
   (as the PRD literally reads), we drop the DEK layer.
2. **KDF split.** From `masterPassword + email + crypto_salt`:
   - `MasterKey = Argon2id(pw, salt=crypto_salt, ad="cloak:mk")` — never leaves device.
   - `authHash  = Argon2id(pw, salt=crypto_salt, ad="cloak:auth")` — sent to server.
   Server stores `bcrypt/argon2(authHash + server_salt)` as `password_hash`, so a DB leak does not
   yield a replayable login token.
3. **Session tokens.** Short-lived **JWT access token** (~15 min) + rotating **refresh token**
   (httpOnly, stored via Tauri secure storage). 2FA gates issuance of the first token pair.
4. **Backend stack pin.** Node.js **LTS (22.x)**, Express **5**, Mongoose **8**, **Zod** for both
   boot-config validation and request validation, `pino` (structured logging + redaction), `helmet`,
   `cors`, `express-rate-limit`, `resend` SDK, `cloudinary` SDK. `envalid` is **not** used server-side
   — it is reserved for the desktop `.env`-import UX only (see item 9).
5. **Rust crypto crates.** RustCrypto: `chacha20poly1305`, `argon2`, `k256` (secp256k1/ECIES),
   `rand_core`; `keyring` crate (or Tauri `stronghold`/`store` plugins) for OS secure storage;
   `zeroize` for wiping plaintext buffers.
6. **Frontend versions.** React 19 (compiler enabled), TypeScript strict, Vite, Tailwind v4,
   shadcn/ui + Radix, TanStack Query v5, Zustand (app/session state) + Jotai only if atom-level
   needs emerge, React Hook Form + Zod, Framer Motion (GSAP reserved for hero/onboarding motion).
7. **Repo layout.** Single Git repo with two roots already present: `desktop/` (Tauri app) and
   `api/` (Express service). pnpm workspace at repo root.
8. **Dev database.** Local MongoDB for development; MongoDB Atlas for
   staging/production. Cloudinary uses a dedicated dev folder/unsigned-less signed uploads.
9. **Env validation libs.** `dotenv-parse` + `envalid` run in the **webview (JS)** for the import
   UX (they are Node/JS libraries and only touch plaintext the user just supplied, pre-encryption);
   the resulting cleaned map is handed to the Rust core for encryption.

---

## 4. Repository Structure (target)

```
cloak/
├─ package.json                 # pnpm workspace root, shared scripts
├─ pnpm-workspace.yaml
├─ .env.example                 # non-secret config template (see below)
├─ docs/                        # existing PRD + sketches (source of truth)
├─ api/                         # Node.js / Express gateway (MVC)
│  ├─ src/
│  │  ├─ app.ts                 # Express app assembly, NO listen() — importable by Supertest
│  │  ├─ server.ts              # entry point: listen() + SIGTERM/SIGINT graceful shutdown
│  │  ├─ config/                # Zod-validated, typed config object (crash-early at boot)
│  │  ├─ models/                # Mongoose models: User, EnvFile, Cred, ApiKey, Platform, AuditLog
│  │  ├─ routes/                # route definitions, mounted under /api/v1
│  │  ├─ controllers/           # async handlers; throw typed errors; consistent envelope
│  │  ├─ services/              # business logic + integrations (resend, cloudinary, tokens)
│  │  ├─ middlewares/           # requireAuth, tiered rate-limit, request logger, error handler
│  │  ├─ validators/            # Zod request schemas (body/params/query)
│  │  ├─ lib/                   # jwt, server-side hashing, errors (AppError hierarchy), logger
│  │  └─ utils/
│  └─ tests/                    # Supertest integration + factories
└─ desktop/                     # Tauri app
   ├─ src-tauri/                # Rust core
   │  ├─ src/
   │  │  ├─ main.rs
   │  │  ├─ crypto/             # kdf, xchacha, ecies-dotenvx, zeroize
   │  │  ├─ keystore/           # OS secure storage (remember-me)
   │  │  ├─ commands/           # #[tauri::command] surface for the webview
   │  │  └─ session/            # in-memory master key / DEK holder
   │  └─ tauri.conf.json
   └─ src/                      # React frontend
      ├─ main.tsx / App.tsx
      ├─ routes/                # auth, dashboard, project, env-view, settings
      ├─ features/              # creds, env, backup-codes, api-keys, import
      ├─ components/ui/         # shadcn primitives
      ├─ lib/                   # tauri invoke wrappers, api client, query keys
      ├─ stores/                # zustand session/ui stores
      └─ styles/
```

---

## 5. Cryptographic Architecture

### 5.1 Registration
1. Client generates `crypto_salt` (≥16 random bytes, base64).
2. Client derives `MasterKey` and `authHash` (see §3.2).
3. Client generates random `VaultDEK`; computes `wrappedDEK = XChaCha20Poly1305(MasterKey, VaultDEK)`.
4. Client POSTs `{ email, authHash, crypto_salt, wrappedDEK }` to `POST /auth/signup`.
5. Server stores `password_hash = serverHash(authHash)`, `crypto_salt`, `wrappedDEK`,
   `is_verified=false`; sends verification email (Resend).

### 5.2 Login + 2FA

**Model: client derives, server verifies.** The KDF runs on-device (zero-knowledge), but the
verification decision and data release stay server-side. The client never fetches or compares the
stored hash locally — otherwise `password_hash` would become a replayable bearer credential and a
tampered client could bypass the check entirely.

1. **Prelogin (salt only).** `POST /auth/prelogin { email }` → returns **only**
   `{ crypto_salt, two_factor_enabled }`. Never returns the full user document, `password_hash`, or
   `wrappedDEK` to this unauthenticated call. The client reads `crypto_salt` directly (it is its own
   public field — nothing is "extracted" from any hash).
2. **Local derivation.** Client re-derives `MasterKey` + `authHash` from the entered password using
   the fetched `crypto_salt`. The password never leaves the device.
3. **Server verification.** `POST /auth/login { email, authHash }` → server compares
   `serverHash(authHash)` against the stored `password_hash`. Only the server decides pass/fail.
4. If `two_factor_enabled`: server emails a time-boxed OTP (Resend); client submits
   `POST /auth/2fa { email, otp }`.
5. On success server returns `{ accessToken, refreshToken, wrappedDEK }`.
6. Client unwraps `VaultDEK` in Rust core using `MasterKey`; keeps `MasterKey`+`VaultDEK` in Rust
   memory only.

**Two-salt clarification.** `crypto_salt` (public, own field) feeds the *client-side* Argon2id KDF.
`password_hash` is the *server-side* `serverHash(authHash + server_salt)` whose salt is embedded in
the server hash and must never be sent to the client. They are distinct and serve different layers.

**Enumeration mitigation.** `prelogin` reveals whether an account exists (a real salt only returns
for real emails). Return a **deterministic fake salt** derived from the email for unknown accounts,
and apply the same 5-per-15-min rate limit to `prelogin` as to login/OTP.

### 5.3 Field encryption / decryption
- Every encrypted field = `XChaCha20Poly1305(VaultDEK, plaintext)` → base64(nonce ‖ ciphertext ‖ tag).
- Decrypt only on explicit reveal/copy; wipe plaintext buffers with `zeroize` after use.

### 5.4 `.env` (dotenvx-compatible)
- Per env file, generate a `secp256k1` keypair. Public key encrypts each value via ECIES
  (dotenvx-compatible framing); values are stored as `encrypted:...` entries in the `.env` text.
- The **private key** is wrapped: `encrypted_dotenvx_key = XChaCha20Poly1305(VaultDEK, privKey)`.
- The encrypted `.env` text blob → Cloudinary; the returned `path` + `encrypted_dotenvx_key` → Mongo.
- "Reveal All" decrypts the whole map in Rust and streams results to the webview transiently.

### 5.5 Remember-Me (30 days)
- On opt-in, store `MasterKey` (and/or `wrappedDEK` context) in OS secure storage with a bound
  timestamp: macOS Keychain, Windows Credential Manager, Linux Secret Service.
- On boot: if `now - stored_at ≤ 30d`, load key from keychain and auto-open workspace; else purge
  the entry and route to password login.

---

## 6. Data Model (reconciled with Cloudinary)

Collections per PRD §5, with env blobs in Cloudinary. All fields marked *(enc)* are
XChaCha20-Poly1305 ciphertext produced client-side; the server treats them as opaque strings.

- **`users`** — `email` (unique), `is_verified`, `verified_at`, `password_hash` (server hash of
  authHash), `crypto_salt`, `wrappedDEK`, `two_factor_enabled`, `created_at`, `updated_at`,
  `last_login_at`, `projects[]` = `{ name, url?, note? }`.
- **`env-file`** — `project_id` (ref), `label`, `tag` (`Local|Staging|Production|Custom`),
  `encrypted_dotenvx_key` *(enc)*, `path` (Cloudinary reference).
- **`creds`** — `name`, `url?`, `username` (plaintext — not a secret; searchable metadata),
  `password` *(enc)*, `note?`.
- **`api-keys`** — `label`, `url?`, `key` *(enc)*, `note?`.
- **`platform`** — `user_id` (ref), `name`, `note?`,
  `backup_codes[]` = `{ encrypted_code (enc), is_used=false, used_at? }`.
- **`audit-log`** — `user_id?` (ref), `action` (e.g. `auth:login`, `cred:delete`), `resource`,
  `resource_id?`, `ip`, `user_agent`, `created_at`. **Metadata only** — never stores secret
  plaintext or ciphertext.

All secret-bearing collections carry a `user_id` (tenant isolation) and timestamps; searchable
metadata (`name`, `label`, `tag`, project names, variable keys) is stored **unencrypted** to
satisfy the instant client-side search requirement (PRD §6 UI Input Filtering).

---

## 7. API Surface (Express gateway)

All routes are mounted under **`/api/v1`**, TLS-only, Zod-validated, tiered-rate-limited,
`helmet`-hardened, and (except the auth/health public set) behind the JWT guard with `user_id`
scoping. Endpoints below omit the `/api/v1` prefix for brevity.

```
# Public (no JWT)
GET    /health                 -> liveness  {status:'ok'}
GET    /ready                   -> readiness (pings Mongo; 503 if down)
POST   /auth/signup            {email, authHash, crypto_salt, wrappedDEK}
POST   /auth/prelogin          {email} -> {crypto_salt, two_factor_enabled}   # salt only; deterministic fake salt for unknown emails
POST   /auth/login             {email, authHash} -> tokens | {twoFactorRequired:true}   # server verifies serverHash(authHash)
POST   /auth/2fa               {email, otp} -> tokens + wrappedDEK
POST   /auth/refresh           {refreshToken} -> tokens
GET    /auth/verify-email      ?token

# Authenticated
POST   /auth/logout
POST   /me/2fa                 enable/disable
GET    /projects  POST /projects  PATCH/DELETE /projects/:id
GET    /env-files POST /env-files (multipart -> Cloudinary) PATCH/DELETE /env-files/:id
GET    /env-files/:id/blob     -> signed Cloudinary URL / streamed blob
GET    /creds     POST /creds     PATCH/DELETE /creds/:id
GET    /api-keys  POST /api-keys  PATCH/DELETE /api-keys/:id
GET    /platforms POST /platforms PATCH/DELETE /platforms/:id
PATCH  /platforms/:id/backup-codes/:codeId   {is_used}
```

### 7.1 API Conventions

- **Response envelope (everywhere).** Success `{ data, meta? }`; error `{ status:'error', code, message }`.
  List endpoints return `meta.pagination { page, size, totalItems, totalPages }`.
- **Error handling.** Typed `AppError` hierarchy (`NotFoundError`, `ValidationError`,
  `UnauthorizedError`, `RateLimitError`, `ServiceUnavailableError`). All async controllers wrapped in
  an `asyncHandler`; a single global error handler is registered **last** and maps `AppError →
  statusCode`, logs unexpected errors, and returns a generic 500 body (never leaks internals).
- **Middleware order.** `helmet` → `express.json({ limit })` → `cors` → request-logger →
  `apiLimiter` → routes → 404 handler → error handler (last). (No inbound webhooks are needed; if
  Cloudinary/Resend webhooks are added later, mount their raw-body routes *before* `express.json`.)
- **Auth guard.** JWT `requireAuth` using an **explicit public-route Set** (never a substring
  allowlist), attaching `req.user` and enforcing `user_id` tenant scoping on every query.
- **Tiered rate limiting.** `authLimiter` (5 / 15 min — PRD requirement) on
  `signup/prelogin/login/2fa/refresh`; `uploadLimiter` on env-file uploads; looser `apiLimiter`
  globally.
- **Validation.** Zod schemas in `validators/` applied via a `validate(schema)` middleware for
  body/params/query; `req.body` is replaced with the parsed, typed result.
- **Config.** Single Zod-validated typed `config` object built at boot; the process **crashes
  early** on missing/invalid required vars. Optional services (Resend, Cloudinary) degrade
  gracefully — warn once when unconfigured, throw a clear 503 only if actually invoked.
- **Logging.** `pino` structured logs with `redact: ['password','token','authorization','authHash',
  'wrappedDEK','refreshToken']`; a per-request child logger carries `requestId/method/path`.
- **Audit log.** Sensitive mutations (login success/failure, 2FA changes, secret create/update/
  delete) are written to a durable `AuditLog` collection (who/action/resource/ip/ua/when) —
  **metadata only, never plaintext or ciphertext payloads**.
- **Process safety.** `server.ts` drains on SIGTERM/SIGINT (stop accepting, finish in-flight,
  disconnect Mongo, force-exit timeout) and exits on `uncaughtException`/`unhandledRejection`.

---

## 8. Phased Roadmap

Each phase ends with a demoable, testable increment. Acceptance criteria are the "done" bar.

### Phase 0 — Foundations & Tooling
- Initialize Git repo; pnpm workspace; root scripts; `.editorconfig`, ESLint/Prettier, TS strict.
- Scaffold `api/` (Express 5 + TS) with the MVC skeleton: `app.ts` (no `listen`) + `server.ts`
  (listen + graceful shutdown), Zod-validated typed `config`, pino request logger, `AppError`
  hierarchy + `asyncHandler` + global error handler, response envelope, `helmet`/`cors`/tiered
  rate-limiters, and `/health` + `/ready`.
- Scaffold `desktop/` (Tauri + React 19 + Vite + Tailwind v4 + shadcn).
- `.env.example`; Mongoose connection wired into `/ready` against the system MongoDB instance.
- CI skeleton (lint + typecheck + build for all three targets).
- **Done when:** `pnpm dev` boots the Tauri shell; API `/health` returns 200 and `/ready` returns
  200 against local Mongo (503 when Mongo is down); an intentionally-thrown route returns the
  standard error envelope.

### Phase 1 — Cryptographic Core (Rust)
- Implement `crypto/`: Argon2id KDF (MasterKey + authHash contexts), XChaCha20-Poly1305 seal/open,
  DEK generate/wrap/unwrap, `zeroize` wiping.
- Implement dotenvx-compatible ECIES (`k256`) encrypt/decrypt with round-trip tests against a known
  dotenvx sample.
- In-memory `session` holder for MasterKey/DEK; Tauri command surface (`encrypt_field`,
  `decrypt_field`, `unwrap_dek`, `env_encrypt`, `env_reveal_all`).
- **Done when:** unit tests prove encrypt→decrypt round-trips and dotenvx interop; keys never
  serialize to disk.

### Phase 2 — Auth & Session (end-to-end) — ✅ DONE
- API: signup/prelogin/login/2fa/refresh/logout controllers + Zod validators + services, server-side
  Argon2id hashing of the client authHash, JWT `requireAuth` guard, email verification, `authLimiter`
  (5/15min, skipped under test), rotating refresh tokens (hashed, TTL-indexed), and audit-log entries
  for auth events. `prelogin` returns a deterministic fake salt for unknown emails (enumeration
  defense).
- Resend integration (graceful-degrade → logs when unconfigured) for verification + OTP; 2FA
  enable/disable via `POST /me/2fa` and challenge completion via `POST /auth/2fa`.
- Desktop: brand/onboarding + login/2FA/verify screens (RHF + Zod, segmented OTP input, password
  strength meter), client-side KDF via Rust (`derive_auth_hash` + `unlock_session`), in-memory token
  store with transparent 401→refresh, zustand auth/session store driving an `AuthScreen`↔`AppShell`
  gate.
- 30-day Remember-Me via OS secret-service (`keyring` v3, pure-Rust D-Bus backend): DEK + refresh
  token persisted in the keychain (DEK never crosses the webview), boot-time restore with 30-day
  window check + auto-purge; graceful fallback to login when no Secret Service is available.
- **Verified:** 13 Supertest integration tests (full signup→verify→login→2FA→refresh→logout),
  6 Rust unit tests, clean typechecks, and a green desktop production build.
- **Deferred:** login does not yet hard-block unverified accounts (UI enforces the verify step);
  ESLint config was not part of Phase 0 scaffolding and remains a follow-up.
- **Done when:** a user can sign up, verify, log in with OTP, stay logged in ≤30 days, and the
  server only ever sees hashes/ciphertext. ✅

### Phase 3 — Vault CRUD + Secure Display — ✅ DONE
- **API:** `/vault/{creds,api-keys,platforms,projects}` CRUD (user-scoped, opaque ciphertext),
  backup-code sub-resource (`/platforms/:id/codes` add + `is_used` toggle), embedded projects on the
  user; `GET /me` profile; Supertest coverage (ownership, validation). Test files serialized
  (`fileParallelism: false`) since integration suites share one Mongo.
- **Desktop:** unified `useCreds/useApiKeys/usePlatforms/useProjects` hooks that branch between
  **real** (TanStack Query + Rust field crypto) and **Sandbox** (in-memory store). `SecretField`
  now decrypts on demand via the Rust core; create/edit modals encrypt before save; empty states
  with CTAs for new users. Backup codes are **encrypted-by-default** with per-code reveal/copy +
  mark-used. Settings reflect real DB state (functional 2FA toggle → `POST /me/2fa`, Remember-Me
  status via `remember_status`, working theme switch).

### Recovery Key + Email (zero-knowledge account recovery) — ✅ DONE
- Signup now generates a one-time **recovery key** (Crockford base32); the DEK is wrapped by both
  the MasterKey and a recovery-key-derived key (`recovery_wrappedDEK`). Shown once post-signup.
- `/auth/recovery/{start,verify,reset}`: email OTP proves identity → returns salt + recovery
  envelope + short-lived recovery token → client unwraps DEK with the recovery key, sets a new
  master password, re-wraps both envelopes, and the server rotates credentials + revokes sessions.
- Rust: `crypto_recovery_reset`; desktop: forgot-password screens; scary "vault is gone" copy
  replaced with recovery-key guidance.

### Sandbox mode — ✅ DONE
- Auth screen "Explore a sandbox" button → `useAppMode` renders the full shell backed by dummy data
  with no API/crypto calls; titlebar shows a Sandbox badge + Exit. Real login remains fully API-wired.

### Phase 4 — Environment Files & dotenvx Workflow — ✅ DONE (core)
- **API:** `/vault/env-files` CRUD backed by **Cloudinary** (raw resource upload/overwrite/destroy,
  proxied `GET /:id/raw` for authorized fetch). Metadata in Mongo: `label`, `tag`,
  `encrypted_dotenvx_key` (nullable = view-only), `path`, `url`, `variable_count`.
- **Rust:** whole-file dotenvx crypto — `crypto_env_encrypt_new` (generate keypair, encrypt file,
  wrap private key with the **DEK** so Remember-Me restore can still decrypt), `crypto_env_decrypt`,
  `crypto_env_encrypt_existing` (edit re-encrypt under the file's public key), `crypto_env_wrap_key`
  (encrypted import with a supplied key), `crypto_env_count_variables`.
- **Import flow:** plaintext (auto keygen + encrypt + wrap) vs already-encrypted (optional key with
  safety messaging; blank ⇒ `encrypted_dotenvx_key: null`, view-only).
- **View editor:** replaces "Reveal All" — read-only raw (from Cloudinary) → **Decrypt** →
  **Edit** (tracks changes, re-encrypts + saves) → **Delete** (confirm → Cloudinary + Mongo). Decrypt
  disabled with an explanatory note when no key is stored.
- **Deferred:** `dotenv-parse`/`envalid` validation UX with per-line Skip (planned for import polish).

### Phase 5 — Import / Export — ✅ DONE
- **Import** (`ImportCredsModal` on `CredentialsPage`): dependency-free RFC-4180 CSV parser
  (`lib/csv-parse.ts`) + Google Password Manager header auto-mapping (`name,url,username,password,note`,
  tolerant of synonyms/column drift), editable per-field column mapping, live preview table, and
  duplicate-skip (same name & username, vs existing vault + within-file). Rows encrypt the password
  via the Rust core (username stored plaintext) before save; works in Sandbox too.
- **Export** (`ExportCredsModal`): two portable formats via `lib/vault-export.ts` —
  (1) passphrase-sealed `.cloak` backup (WebCrypto PBKDF2-SHA256 → AES-256-GCM, DEK-independent,
  re-importable), and (2) Google-compatible plaintext CSV behind an explicit acknowledgement. Both
  stream to disk via a Blob download.
- **Round-trip:** a Cloak CSV export re-imports losslessly; an encrypted `.cloak` backup is detected
  on import and decrypted with its passphrase into the same mapping/preview pipeline.
- **Done when:** a Google CSV imports losslessly and a re-export reproduces the entries. ✅

### Phase 6 — Hardening, UX Polish, Release
- Enforce §6 safeguards: TLS 1.3 assertions, no plaintext in logs, memory zeroization audit.
- Framer Motion/GSAP polish, empty/loading/error states, keyboard-first UX.
- E2E tests, packaging for Linux/Windows/macOS, auto-update config, README + user docs.
- **Done when:** signed installers build in CI for all three OSes and the security checklist passes.

---

## 9. Cross-Cutting Concerns

- **Security checklist (PRD §6):** TLS 1.3 only; auth/OTP rate limits (5/15min); no plaintext
  secrets or dotenvx keys on disk or in logs; `zeroize` on all transient plaintext; search limited
  to unencrypted metadata.
- **Testing:** Rust unit tests (crypto, interop); API integration tests via **Supertest importing
  `app.ts` directly** (no `listen`) against the system MongoDB instance, with faker-based factories; frontend
  component tests (Vitest + Testing Library); Phase-6 E2E. Cover happy path + validation failure +
  auth failure per endpoint.
- **Config/secrets:** single **Zod-validated, typed `config`** object built at boot (crash-early on
  missing required vars); optional services degrade gracefully. `.env.example` documents
  `NODE_ENV`, `PORT`, `MONGODB_URI`, `JWT_SECRET` (≥32), `REFRESH_SECRET` (≥32), `RESEND_API_KEY`,
  `CLOUDINARY_URL`, `OTP_TTL`, `RATE_LIMIT_*`, `CORS_ORIGIN`, `LOG_LEVEL`.
- **CI/CD:** GitHub Actions — lint/typecheck/test on PR; matrix build of Tauri bundles
  (Linux/Windows/macOS) + API image on tag.
- **Observability:** `pino` structured logs with `redact` on all secret-bearing keys; per-request
  child logger with `requestId`; durable `AuditLog` for sensitive mutations (metadata only). No
  secret material (plaintext or ciphertext payloads) is ever logged.
- **Process safety:** graceful SIGTERM/SIGINT drain with force-exit timeout; `fatal`-log and exit
  on `uncaughtException`/`unhandledRejection` (let the orchestrator restart).

---

## 10. Open Items & Risks

1. **dotenvx interop fidelity** — must validate our Rust ECIES output against a real dotenvx
   decryptor early (Phase 1 spike) to guarantee compatibility.
2. **Cloudinary for secret blobs** — encrypted before upload, but confirm signed-URL access model
   and retention/deletion semantics; consider access-control on the delivery URL.
3. **DEK layer** — confirm the §3.1 envelope-encryption approach vs. literal direct Master-Key
   encryption in the PRD.
4. **Remember-Me on Linux** — Secret Service availability varies by distro/headless; define
   fallback when unavailable.
5. **Google CSV format drift** — Google's export columns can change; import mapper must be tolerant.

---

## 11. Immediate Next Steps

1. Confirm the [§3 Working Decisions](#3-working-decisions-correctable) (especially the DEK layer).
2. Execute **Phase 0** scaffolding.
3. Run the **Phase 1** dotenvx-interop spike to de-risk the compatibility requirement before
   building the env workflow.
