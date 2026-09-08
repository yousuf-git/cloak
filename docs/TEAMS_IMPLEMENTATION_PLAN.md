# Cloak Teams — Implementation Plan

Companion to `docs/TEAMS_ROADMAP.md`. That document parks the *what*; this one is the
*how*.

**Status: implemented.** Kept as the record of what was planned and why. For how
the shipped system actually works, read `docs/TEAMS_ARCHITECTURE.md`. Deviations
taken during the build:

- `crypto_box` 0.9.1's `seal` feature was confirmed against the crate source, so
  the fallback construction described in Phase 1 was not needed. `sha2` was added
  alongside it for public-key fingerprints.
- No `crypto/org.rs` module: it would only have re-exported `generate_dek`, so
  org key material is minted directly from `crypto/dek.rs` and `crypto/kdf.rs`.
- Each org carries its own `org_recovery_salt`, which the plan did not name.
- Signup mints the identity keypair *and* the default org's key material in one
  `crypto_prepare_signup` call, so a new account is usable after one round trip.
  Two recovery keys are therefore shown on the same post-signup screen.
- `Platform` gained `project_id`, which it alone lacked, for consistency.

## Context

`docs/TEAMS_ROADMAP.md` maps five gaps in consumer password managers to candidate
Cloak features: RBAC, audit trails, multi-user management and delegation, secure
sharing, and surviving offboarding. None of it exists today: every vault resource is
scoped by `user_id` alone, there is no `role` field anywhere, `ForbiddenError`
(`api/src/lib/errors.ts:35`) is never thrown, Projects are an embedded subdocument
array on `User`, and `AuditLog` is write-only with no read endpoint and no UI.

This plan implements all five gaps. The outcome: Cloak becomes org-first — every user
belongs to at least one organization, every secret lives in an org, membership and
roles are enforced server-side, secrets are shared by wrapping an Org DEK to each
member's public key entirely client-side, and admins get a per-org audit view.
Zero-knowledge is preserved: the server never gains the ability to decrypt anything.

### Decisions

| Decision | Choice |
|---|---|
| Scope | Full roadmap, all five gaps |
| Sharing unit | One DEK per org |
| Identity primitive | X25519 sealed box (`crypto_box`) |
| Admin UI | Desktop Tauri app only; `web/` stays marketing-only |
| Orgs | **Mandatory for everyone.** Every user gets a default org at signup (named "Personal Space", renameable). There is no personal-vault code path |
| Projects | Belong to an org only. Promoted out of the `User` subdoc into their own collection |
| Invitations | Two-step admin grant |
| Offboarding | Re-seal only (drop membership + revoke tokens). No key rotation. Limitation documented for a future change |
| Billing / seats | Out of scope |
| Existing data | One test user, no live users. A dev reset script wipes it; no migration machinery |

---

## Key hierarchy

The existing envelopes are untouched. Two layers are added on top.

```
password + crypto_salt --Argon2id("cloak:mk")--> Master Key
                       --Argon2id("cloak:auth")--> authHash  (to server)

Master Key       --open--> User.wrappedDEK             --> personalDEK   [unchanged]
recovery key     --open--> User.recovery_wrappedDEK    --> personalDEK   [unchanged]

personalDEK      --open--> User.wrapped_identity_sk    --> identity_sk   [NEW]
identity_sk      --open--> Membership.wrapped_org_dek  --> OrgDEK        [NEW, per org]
org recovery key --open--> Org.org_recovery_wrappedDEK --> OrgDEK        [NEW, break-glass]

OrgDEK           --seal--> every secret field in that org
```

`personalDEK` no longer encrypts vault data. Its only remaining job is wrapping
`identity_sk`. It is wrapped under the DEK rather than the Master Key deliberately:
the DEK survives password changes and is already covered by the recovery envelope, so
the identity key inherits recovery for free. This is the same pattern the dotenvx env
private key already uses (`desktop/src-tauri/src/commands/crypto.rs:262`).

Unlock therefore becomes a chain: password → Master Key → personal DEK → identity
private key → one Org DEK per membership. The Tauri commands pick the right key from
session state by org id; React never touches key material, exactly as today.

### Security properties to state plainly

- **RBAC is authorization, not cryptography.** With one DEK per org, every member who
  can decrypt anything can decrypt everything in that org. `viewer` and `member` have
  identical decrypt capability; they differ only in what the API permits. Per-project
  DEKs would have been the finer boundary and were considered and rejected for this pass.
- **Removal is server-side only.** A removed member who cached the Org DEK keeps the
  ability to decrypt any org ciphertext they exfiltrated before removal. This is the
  accepted consequence of skipping rotation. See the deferred-rotation note in Phase 7.
- **Public-key substitution is the residual trust in the server.** The server serves
  member public keys to the granting admin. A malicious server could substitute its own
  key and receive an Org DEK sealed to it. Mitigation for this pass: display a short key
  fingerprint in the grant UI so an admin can verify out of band. Full TOFU/pinning is
  out of scope.

---

## Phase 0 — Reset dev data

The server holds no keys, so it cannot re-encrypt the one existing user's secrets from
`personalDEK` to an `OrgDEK`. With no live users, the correct move is a wipe.

- New `api/scripts/reset-dev-data.ts` — connects via `api/src/lib/db.ts`, drops
  `users`, `creds`, `apikeys`, `accesskeys`, `sshkeys`, `platforms`, `envfiles`,
  `refreshtokens`, `otps`, `auditlogs`. Refuses to run when `NODE_ENV === 'production'`.
- Add `"reset:dev": "tsx scripts/reset-dev-data.ts"` to `api/package.json`.

Everything after this phase assumes org-required schemas. No dual-shape reads, no
backward compatibility.

---

## Phase 1 — Rust crypto core

Add `crypto_box` to `desktop/src-tauri/Cargo.toml`.

> Confirm the current `crypto_box` sealed-box API against live docs (context7 /
> docs.rs) before writing this — do not code it from memory. If the crate's sealed box
> is not exposed the way we need, compose it from `x25519-dalek` plus the existing
> `chacha20poly1305`: ephemeral keypair, ECDH to the recipient public key, nonce derived
> from `blake2b(ephemeral_pk ‖ recipient_pk)`, wire format `base64(ephemeral_pk ‖ ct ‖ tag)`.
> Same envelope shape either way.

**New `desktop/src-tauri/src/crypto/identity.rs`**

- `generate_identity_keypair() -> (public_key, Zeroizing<secret_key>)`
- `seal_to_public_key(recipient_pk_b64, plaintext) -> String` (base64 envelope)
- `open_sealed(identity_sk, envelope_b64) -> Zeroizing<Vec<u8>>`
- `fingerprint(pk_b64) -> String` — short human-comparable digest for the grant UI
- `#[cfg(test)]`: round-trip, wrong-key failure, tamper failure. Mirrors the existing
  test style in `crypto/aead.rs` and `crypto/dek.rs`.

**New `desktop/src-tauri/src/crypto/org.rs`**

- `generate_org_dek()` — 32 random bytes in `Zeroizing`, same as `crypto/dek.rs:8`
- Reuses `wrap_dek` / `unwrap_dek` from `crypto/dek.rs` for the org recovery envelope
- Reuses `generate_recovery_key`, `normalize_recovery_key`, and the `"cloak:rk"`
  derivation in `crypto/kdf.rs` verbatim for the org recovery key

**Modify `desktop/src-tauri/src/session/mod.rs`**

- `SessionState` gains `identity_sk: Option<Zeroizing<[u8;32]>>` and
  `org_deks: HashMap<String, Zeroizing<[u8;32]>>`
- New accessors `set_identity_sk`, `with_identity_sk`, `set_org_dek`,
  `with_org_dek(org_id, f)` — all returning `CryptoError::SessionLocked` when absent,
  matching `with_dek` at `:30`
- `clear()` wipes both new fields
- `export_dek_b64` / `load_dek_from_b64` stay as-is: Remember-Me still stores only the
  personal DEK, and identity + org keys are re-derived on restore from `/orgs` plus
  `User.wrapped_identity_sk`. `keystore/mod.rs` needs no change.

**Modify `desktop/src-tauri/src/commands/crypto.rs`**

- `crypto_prepare_signup` also returns `identity_public_key` and `wrapped_identity_sk`
  (the DEK is already in scope there, `:49-72`)
- `crypto_bootstrap_org()` → `{ wrapped_org_dek, org_recovery_wrapped_dek, org_recovery_key }`
  — generates an Org DEK, seals it to the caller's own public key, builds the recovery
  envelope, surfaces the recovery key once
- `crypto_load_identity(wrapped_identity_sk_b64)` — unwrap into session
- `crypto_load_org(org_id, wrapped_org_dek_b64)` — open sealed box into session
- `crypto_seal_org_dek_for(org_id, recipient_public_key_b64)` — the admin grant step
- `crypto_org_recovery_unlock(org_id, recovery_key, org_recovery_wrapped_dek_b64)`
- `crypto_encrypt_field` / `crypto_decrypt_field` gain an `orgId` argument and select the
  key via `with_org_dek`
- `crypto_env_wrap_key` / `crypto_env_decrypt` gain `orgId` — the dotenvx private key is
  now wrapped under the Org DEK, not the personal DEK

**Modify `desktop/src/lib/tauri-crypto.ts`** — bindings for all of the above; the
`encryptField` / `decryptField` / `env*` signatures gain `orgId`.

---

## Phase 2 — API data model

New models in `api/src/models/`, following the existing Mongoose style
(`timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }`, inline indexes):

- **`org.model.ts`** — `{ name, owner_id (ref User, indexed), org_recovery_wrappedDEK }`.
  The Org DEK itself is never stored.
- **`membership.model.ts`** — `{ org_id (ref Org, indexed), user_id (ref User, indexed),
  role: 'owner'|'admin'|'member'|'viewer', status: 'pending_key'|'active',
  wrapped_org_dek?: String, invited_by?, joined_at? }`, unique compound index on
  `{ org_id, user_id }`.
- **`invitation.model.ts`** — `{ org_id, email (lowercased, indexed), role, token_hash
  (unique), invited_by, accepted_by?, status: 'pending'|'accepted'|'revoked', expires_at }`,
  with a TTL index on `expires_at` copying `otp.model.ts:27`.
- **`project.model.ts`** — promoted out of the subdoc: `{ org_id (indexed), name, url,
  note, created_by }`.

Modified:

- **`user.model.ts`** — add `identity_public_key: String` and `wrapped_identity_sk: String`;
  delete the `projects` array and `projectSchema` (`:25-32`, `:52`).
- **The six vault models** (`cred`, `api-key`, `access-key`, `ssh-key`, `platform`,
  `env-file`) — add `org_id: { type: ObjectId, ref: 'Org', required: true, index: true }`;
  rename `user_id` to `created_by` (kept for audit attribution, no longer the scope key);
  add compound index `{ org_id, created_at: -1 }`. `Platform` also gains `project_id` for
  consistency with the rest. `project_id` becomes a real `ref: 'Project'` instead of a
  loose unref'd ObjectId, and is validated against the caller's org on write — closing
  the existing dangling-reference hole where nothing verifies a submitted `project_id`
  belongs to the caller.
- **`audit-log.model.ts`** — add `org_id` (ref Org, indexed); compound index
  `{ org_id, created_at: -1 }`; TTL index on `created_at` driven by a new
  `AUDIT_RETENTION_DAYS` in `api/src/config/index.ts`.

---

## Phase 3 — Authorization layer

- **`api/src/types/express.d.ts`** — add `Request.org?: { id: string; role: Role }`.
- **New `api/src/middlewares/require-org.ts`** — resolves the org from an `X-Cloak-Org`
  header (or the `:orgId` param on org routes), loads the caller's `Membership` with
  `status: 'active'`, throws `ForbiddenError` when there is none, and sets `req.org`.
  Mounted after `requireAuth`, same per-router style as `vault.routes.ts:28`.
- **New `api/src/lib/permissions.ts`** — a role → action matrix plus
  `assertCan(role, action)` throwing `ForbiddenError`. This is where `ForbiddenError`
  finally gets used.

| Action | viewer | member | admin | owner |
|---|---|---|---|---|
| read vault resources | yes | yes | yes | yes |
| create/update/delete vault resources, projects | — | yes | yes | yes |
| invite, grant, remove members, change roles below owner | — | — | yes | yes |
| read/export audit, rename org | — | — | yes | yes |
| delete org, transfer ownership, break-glass | — | — | — | yes |

- **`api/src/services/vault.service.ts`** — the `Owner` type becomes `orgId`; every filter
  changes from `{ user_id: userId }` to `{ org_id: orgId }` (one line per function, about
  eighteen functions). Each `createX` writes `{ ...data, org_id, created_by }`. The
  Projects section (`:153-183`) is rewritten against the new `Project` collection and
  stops touching `User`.
- **`api/src/controllers/vault.controller.ts`** — `uid()` (`:8-11`) is replaced by an
  `orgScope(req)` helper returning `{ orgId, role, userId }`; each handler calls
  `assertCan` before delegating; every `recordAudit` call gains `orgId`.
- **`api/src/routes/vault.routes.ts`** — `vaultRouter.use(requireAuth, requireOrg)`.

---

## Phase 4 — Orgs, membership, invitations

New: `api/src/services/{org,membership,invitation}.service.ts`,
`api/src/controllers/org.controller.ts`, `api/src/routes/org.routes.ts`,
`api/src/validators/org.validators.ts`.

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/orgs` | any | body carries `wrapped_org_dek` (sealed to self) and `org_recovery_wrappedDEK` |
| GET | `/orgs` | any | my orgs, each with my role and my `wrapped_org_dek` |
| PATCH | `/orgs/:id` | admin | rename |
| DELETE | `/orgs/:id` | owner | refuses if it is the caller's last org |
| POST | `/orgs/:id/transfer` | owner | transfer ownership |
| GET | `/orgs/:id/members` | viewer | includes public keys and fingerprints |
| GET | `/orgs/:id/members/pending` | admin | accepted invitees awaiting a key grant |
| POST | `/orgs/:id/members/:userId/grant` | admin | uploads `wrapped_org_dek`, flips status to `active` |
| PATCH | `/orgs/:id/members/:userId` | admin | role change; cannot target the owner |
| DELETE | `/orgs/:id/members/:userId` | admin | deletes membership, calls `revokeAllForUser` |
| POST | `/orgs/:id/invitations` | admin | emails a link via the existing Resend service |
| GET | `/orgs/:id/invitations` | admin | list and revoke |
| GET | `/invitations/:token` | auth | peek: org name, role, inviter |
| POST | `/invitations/:token/accept` | auth | creates a Membership in `pending_key` |

The two-step invite exists because neither the server nor the invitee can produce the
wrap: the server has no keys, and the invitee has never seen the Org DEK. An already-
admitted admin must come online to seal it to the new member's public key. The
alternative — putting a transit key in the emailed link — was considered and rejected.

Notes:

- Invitation tokens are stored hashed only — reuse `sha256` and `generateOpaqueToken`
  from `api/src/lib/hashing.ts:22,33`, the same shape as refresh tokens.
- Apply the strict `authLimiter` pattern (`api/src/middlewares/rate-limit.ts`) to
  invitation create and accept.
- `POST /auth/signup` (`api/src/services/auth.service.ts`) is extended to accept
  `identity_public_key`, `wrapped_identity_sk`, and the default-org bootstrap payload,
  creating User + Org + owner Membership together so a new user is immediately usable.
- `DELETE /orgs/:id/members/:userId` calling `revokeAllForUser` logs the removed user out
  of *all* their orgs, not just this one. Acceptable and simple; noted here so it is not
  a surprise.

---

## Phase 5 — Audit

- `api/src/services/audit.service.ts` — `recordAudit` gains `orgId`.
- New `listAuditLogs(orgId, { action?, userId?, from?, to?, cursor?, limit })` with keyset
  pagination on the `{ org_id, created_at: -1 }` index.
- `GET /orgs/:id/audit` and `GET /orgs/:id/audit/export.csv`, both admin and above.
- Close the existing coverage gaps in `api/src/controllers/vault.controller.ts`:
  `updatePlatform` (`:97`), all three backup-code handlers (`:106-117`), and all four
  project handlers (`:120-132`) currently write no audit entry at all.
- New actions: `org:create`, `org:rename`, `org:delete`, `org:transfer`,
  `org:break_glass`, `member:invite`, `member:accept`, `member:grant`, `member:remove`,
  `member:role_change`, `audit:export`.
- Audit stays metadata-only — never secret plaintext or ciphertext — the same rule the
  existing writer follows.

---

## Phase 6 — Desktop UI

- **New `desktop/src/stores/org.ts`** — Zustand store holding orgs, `activeOrgId`, and
  the caller's role. After unlock it calls `crypto_load_identity`, then `crypto_load_org`
  per membership, then selects the last-used or default org.
- **`desktop/src/lib/api.ts`** — org, member, invite and audit endpoints; `apiRequest`
  attaches `X-Cloak-Org` from the org store. New DTOs mirroring the validators.
- **`desktop/src/stores/auth.ts`** — the post-unlock path (`:242-287`) hydrates the org
  store; `logout` clears it.
- **`desktop/src/components/AppShell.tsx`** — org switcher in the sidebar header; new nav
  entries `Team` and `Audit`, hidden by role.
- **New pages** in `desktop/src/pages/`: `TeamPage.tsx` (members, roles, pending grants
  with key fingerprints, remove), `AuditPage.tsx` (filterable table plus CSV export),
  `OrgSettingsPage.tsx` (rename, org recovery key reveal, transfer, delete).
- **`ProjectsPage.tsx`** — repointed at the org-scoped Project collection.
- **`desktop/src/hooks/vault.ts`** — query keys become `['creds', orgId]` and so on, so
  switching orgs refetches rather than serving another org's cache.
- **`desktop/src/hooks/useVaultCrypto.ts`** — threads `activeOrgId` into encrypt/decrypt.
- **Invite acceptance** — a screen reachable from a deep link or an email-matched pending
  invitation, reusing the `components/auth` form primitives.
- **Sandbox mode** — `desktop/src/stores/sandbox-data.ts` and
  `desktop/src/lib/sample-data.ts` need a fake org so the demo keeps working.
- Reuse the existing UI primitives throughout (`components/ui/*`, `PageHeader`,
  `ConfirmDialog`, `RowActions`, `EmptyState`); the org recovery key reveal should reuse
  `components/auth/RecoveryKeyReveal.tsx`.

---

## Phase 7 — Break-glass and documentation

- `POST /orgs/:id/break-glass` (owner) returns `org_recovery_wrappedDEK`; the client
  unwraps it with the org recovery key via `crypto_org_recovery_unlock` and re-seals the
  Org DEK to its own public key. Audited as `org:break_glass`.
- **New `docs/TEAMS_ARCHITECTURE.md`** — the key hierarchy above, the invitation
  sequence, the permission matrix, and an explicit deferred-work section (below).
- **`docs/TEAMS_ROADMAP.md`** — rewritten from "parked" to implemented, with the two
  deferred items called out.
- **`docs/CORE_LOGICS.md`** — add the org unlock flow alongside Flows A–F.
- **`web/content/site-content.ts`** `WHY_MATRIX` — add RBAC, audit trail, and secure team
  sharing rows, as the roadmap's marketing section calls for.

### Deferred: Org DEK rotation on offboarding

Recorded here so the future change is a known quantity rather than a rediscovery.

Removing a member currently deletes their `Membership` row and revokes their tokens. The
Org DEK is unchanged, so a member who cached it — or who exfiltrated ciphertext before
removal — retains the ability to decrypt that ciphertext forever. The roadmap's
"offboarding = key rotation" constraint is knowingly not met by this build.

Closing it later requires: an admin client generates `OrgDEK'`; walks every secret in the
org, decrypting with the old key and re-encrypting under the new one; re-seals `OrgDEK'`
to every remaining member's public key; and commits the swap. That job must be batched
and resumable, the org needs a brief write-lock while it runs, and the API needs to
tolerate two live key generations during the transition. The natural trigger is member
removal, with a manual "rotate now" action in `OrgSettingsPage` as well.

---

## Phase 8 — Tests

- **`api/tests/org.test.ts`** (new) — create org, invite, accept, grant, activate; role
  enforcement returns 403 for each denied action; remove member.
- **`api/tests/vault.test.ts`** — updated for org scoping, plus a cross-org isolation
  test: a member of org A gets 404 or 403 on org B resources.
- **`api/tests/audit.test.ts`** (new) — entries carry `org_id`; the read endpoint is
  admin-gated; export shape.
- **Rust** — `#[cfg(test)]` blocks in `crypto/identity.rs` and `crypto/org.rs`, matching
  the existing inline test style.

Pre-existing gaps found while exploring, out of scope unless deliberately picked up:
`desktop` declares `"test": "vitest run"` but has no test files and no vitest config;
`api` and `desktop` both declare `"lint": "eslint src"` with no eslint config or
dependency installed; CI (`.github/workflows/release.yml`) runs neither tests nor lint.

---

## Verification

```bash
# needs a local mongod
pnpm --filter @cloak/api test
cd desktop/src-tauri && cargo test
pnpm -r typecheck
```

Manual end-to-end with two accounts, A and B:

1. Run `pnpm --filter @cloak/api reset:dev`, then sign up as A. Confirm a default org
   exists and that a personal recovery key and an org recovery key are each shown once.
2. Create a project and a credential as A. Confirm the stored document has `org_id` set
   and that the password field is opaque base64 in Mongo.
3. Sign up as B. Invite B into A's org as `viewer`. B accepts; B's membership sits at
   `pending_key` and B sees no secrets.
4. As A, grant B: verify the fingerprint shown matches B's, then complete the grant.
   B reloads and can now decrypt A's credential.
5. As B (`viewer`), attempt an edit — expect 403, not 404.
6. Promote B to `member`; the edit now succeeds. Confirm both attempts appear in
   `GET /orgs/:id/audit`.
7. Remove B; B loses access on the next request and is logged out.
8. As A, run break-glass with the org recovery key and confirm the vault reopens.
9. Switch orgs in the sidebar and confirm the vault lists refetch rather than showing the
   previous org's cached items.
