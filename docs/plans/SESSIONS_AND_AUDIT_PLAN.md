# Cloak — Sessions and Audit

Follows `docs/plans/TEAMS_IMPLEMENTATION_PLAN.md`. That plan built org-first Cloak
and left two things half-finished behind it: refresh tokens that could be issued
and rotated but never inspected or revoked, and an audit trail that recorded
*that* something happened without recording *which thing*.

**Status: implemented.** Kept as the record of what was planned and why. For how
the shipped system works, read `docs/TEAMS_ARCHITECTURE.md` (Audit, Offboarding)
and `docs/INFO_ABOUT_KEYS.md` §10.2.

## Context

Two complaints, both true:

1. A refresh token was a row keyed on `user_id` with a hash and an expiry.
   Rotation revoked the old row; `revokeAllForUser` existed but only a password
   reset called it. Nobody — not the account owner, not an admin — could see
   where an account was signed in, and nothing could end one device's access.
   Replaying a spent token returned 401 and otherwise passed unremarked.
2. An audit entry named an action and a resource **type**. "Someone edited an
   env file" with no way to learn which file, which variables, or whether the
   attempt even succeeded. Failed sign-ins were not recorded at all.

## Part 1 — Sessions

- `RefreshToken` gains `session_id` (shared by every token minted from one
  sign-in, carried forward by each rotation), `session_started_at`,
  `session_expires_at`, `revoked_reason`, and the `ip` / `user_agent` last seen.
  A unique `{ chain_id, seq }`-style pairing is not needed here; `user_id +
  session_id` is indexed for listing and family-wide revocation.
- The access token carries the session as a `sid` claim, which is how
  `GET /me/sessions` marks the calling device as the current one.
- **Reuse detection.** Rotation makes each token single-use, so a second
  presentation means two parties hold it. The server revokes the whole session
  and writes `auth:refresh_reuse`. The honest device is signed out too — the
  intended trade, since the alternative is a thief rotating a chain the owner
  cannot see.
- **Two clocks.** `REFRESH_TOKEN_TTL` (30d) slides forward on every rotation;
  `SESSION_MAX_TTL` (new, 90d) is fixed at sign-in, so an actively-used session
  still ends.
- Endpoints: `GET /me/sessions`, `DELETE /me/sessions/:sessionId`,
  `POST /me/sessions/revoke-others`, `GET /me/security-log`.
- Desktop Settings gains "Where you're signed in" and "Recent account activity".

### Deviation taken during the build

Removing a member used to call `revokeAllForUser`. That was dropped rather than
scoped. Sessions are account-wide and carry no org claim; `requireOrg` resolves
membership on every request, so deleting the membership row already ends org
access on the next call. Revoking sessions added nothing to authorization and
signed the person out of organizations the removal had nothing to do with.

## Part 2 — Audit

- Entries gain `actor_email` (denormalised — the trail has to stay readable
  after a rename or a deleted account, and a refused sign-in has an address but
  no user), `outcome`, `target_label`, and a small flat `context` map.
- `sanitizeContext` allows strings, numbers, booleans and arrays of those,
  clamped in length and count; nested objects are dropped rather than flattened,
  which is what stops a whole request body being passed in by accident.
- Env-file edits name the variables added, removed and changed. dotenvx keeps
  keys in the clear, so the server already held those names; values never enter
  the trail, and a test asserts it.
- `recordAudit` defaults actor and org from the request's access token, so a
  call site names them only when they differ — a missing attribution becomes a
  deliberate omission rather than a forgotten argument.
- Failures are recorded: refused sign-ins, wrong 2FA codes, replayed refresh
  tokens. `org:break_glass_start` is recorded too — handing out the recovery
  envelope is the half an attacker would stop at.

### Tamper evidence

Entries form an append-only hash chain, one per org plus `account` for entries
that belong to a person. Each row hashes over its own content plus the hash
before it, so editing a row breaks its own hash and removing one breaks the link
at the row after it. `GET /orgs/:orgId/audit/verify` walks the chain and reports
how many entries are still provably intact and where it breaks.

Writers serialise on a unique `{ chain_id, seq }` index rather than a lock: read
the head, hash against it, insert; the loser of a race gets a duplicate key and
re-reads. The insert is the commit, so a failed write leaves no gap.

Two limits, both documented rather than papered over: the chain proves nobody
edited the recorded past, not that the past was recorded; and retention expires
the oldest rows, so a chain legitimately stops starting at `seq` 1. Anchoring the
head outside the server would close the first, and is deferred — see
`docs/TEAMS_ARCHITECTURE.md`.

## Part 3 — Offboarding

Org DEK rotation stays deferred, and the reasoning is now written down rather
than implied: membership means holding the org's key, so a member could read
every secret in the org, and a person who can read a secret can write it down.
Re-encrypting Cloak's copy does not reach the copy in their notes.

So removal shows the admin what to rotate instead.
`GET /orgs/:orgId/members/:userId/exposure` returns the org's secrets by name
with their projects, marking the ones the trail shows that member actually
opened. The desktop removal dialog puts the list in front of the admin before
they confirm, as a rotation checklist: change these where they were issued.

## What this touched

| Area | Files |
|------|-------|
| Sessions | `models/refresh-token.model.ts`, `services/token.service.ts`, `lib/jwt.ts`, `middlewares/require-auth.ts`, `controllers/auth.controller.ts`, `routes/auth.routes.ts` |
| Audit | `models/audit-log.model.ts`, `services/audit.service.ts`, `services/audit-query.service.ts`, `lib/audit-hash.ts`, both controllers |
| Offboarding | `services/offboarding.service.ts`, `services/org.service.ts`, `components/RemoveMemberDialog.tsx` |
| Desktop | `lib/api.ts`, `pages/SettingsPage.tsx`, `pages/AuditPage.tsx`, `pages/TeamPage.tsx`, `pages/MemberDetailPage.tsx` |
| Tests | `tests/sessions.test.ts`, `tests/audit-chain.test.ts`, additions to `tests/org.test.ts` |

## Deferred, deliberately

- **Anchoring the audit chain outside the server** — the only thing that would
  make suppression (as opposed to rewriting) detectable.
- **`request_id` on audit entries** — `req.id` already exists; persisting it
  widens the hashed field set and needs a `CHAIN_VERSION` bump.
- **Read events for secrets other than env files** — reads arrive through the
  list responses every vault page fetches, so auditing them as things stand
  would produce an entry per page load. Needs "list metadata" separated from
  "reveal this one secret" at the API first.
- **Admin visibility into a member's sessions** — a force-sign-out lever for the
  compromised-account case, kept distinct from removal. Not built: showing an
  admin a member's IPs and devices is a surveillance surface spanning that
  member's whole account, including orgs the admin has nothing to do with.
- **Per-record key wrapping** — would make Org DEK rotation cheap (re-wrap one
  32-byte key per record instead of rewriting every payload). Worth doing if the
  payload schema is ever revised.
