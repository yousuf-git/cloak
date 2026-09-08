# Teams Architecture

How multi-user Cloak works, as built. Companion to `docs/CORE_LOGICS.md`, which
covers the single-account crypto this builds on.

## Orgs are mandatory

Every account belongs to at least one organization. Signup provisions one called
"Personal Space" (renameable), and every vault resource — credential, API key,
access key, SSH key, platform, env file, project — carries a required `org_id`.
There is no personal-vault code path: a solo user is an org of one.

## Key hierarchy

The pre-teams envelopes are unchanged. Two layers sit on top of them.

```
password + crypto_salt --Argon2id("cloak:mk")----> Master Key
                       --Argon2id("cloak:auth")--> authHash  (to the server)

Master Key       --open--> User.wrappedDEK             --> personal DEK
recovery key     --open--> User.recovery_wrappedDEK    --> personal DEK

personal DEK     --open--> User.wrapped_identity_sk    --> identity secret key
identity sk      --open--> Membership.wrapped_org_dek  --> Org DEK   (per org)
org recovery key --open--> Org.org_recovery_wrappedDEK --> Org DEK   (break-glass)

Org DEK          --seal--> every secret field in that org
```

The personal DEK no longer encrypts vault data. Its only remaining job is
wrapping the identity secret key. Wrapping under the DEK rather than the Master
Key is deliberate: the DEK survives password changes and is already covered by
the account recovery envelope, so the identity key inherits recovery for free.
This mirrors how the dotenvx env private key is already stored.

**Primitives.** Identity keypairs are X25519; wrapping an Org DEK for a member
uses the libsodium sealed-box construction from the `crypto_box` crate
(`crypto/identity.rs`), which needs no keypair on the sender's side. Field
encryption is unchanged: XChaCha20-Poly1305 via `crypto/aead.rs`.

## What the server can and cannot do

The server stores `identity_public_key` in the clear — it is public by design —
plus `wrapped_identity_sk`, `Membership.wrapped_org_dek`, and
`Org.org_recovery_wrappedDEK`, all opaque. It never holds an Org DEK, an
identity secret key, a master key, or any plaintext. Adding a member is
therefore something the server physically cannot do on its own.

## Joining takes two steps

Neither the server (no keys) nor the invitee (has never seen the Org DEK) can
produce the wrap that admits a new member. Someone who already holds the key
must do it from their own device.

1. **Invite.** An admin creates an `Invitation` bound to one email address. Only
   a SHA-256 hash of the emailed token is stored, and the row carries a TTL.
2. **Accept.** The invitee signs in with that same email and accepts. This
   creates a `Membership` with `status: 'pending_key'` — visible, but able to
   read nothing. `GET /orgs` returns pending memberships alongside active ones
   so the joiner sees the org listed as *Awaiting key* rather than having it
   silently absent; the client refuses to make such an org active, since every
   vault request against it would be rejected.
3. **Grant.** An admin opens Team, compares the invitee's key fingerprint out of
   band, and confirms. Their client calls `crypto_seal_org_dek_for`, which seals
   the Org DEK to the invitee's public key inside the Rust core, and uploads the
   result. The membership flips to `active`.

The invitation is bound to the invited email, so a leaked link does not admit
whoever opens it.

## Roles

| Action | viewer | member | admin | owner |
|---|---|---|---|---|
| read vault resources | yes | yes | yes | yes |
| create/update/delete vault resources, projects | — | yes | yes | yes |
| invite, grant, remove members, change roles below owner | — | — | yes | yes |
| read/export audit, rename org | — | — | yes | yes |
| delete org, transfer ownership, break-glass | — | — | — | yes |

Defined once in `api/src/lib/permissions.ts` and enforced by `assertCan` in the
controllers. `api/src/middlewares/require-org.ts` resolves the active org from
the `X-Cloak-Org` header (or an `:orgId` route param) and requires an **active**
membership.

**Roles are authorization, not cryptography.** Every active member of an org
holds the same Org DEK, so a `viewer` can decrypt exactly what an `admin` can —
they differ only in what the API permits. The only cryptographic boundary is org
membership itself. Per-project or per-item DEKs would draw a finer line; they
were considered and deliberately not built.

## Audit

`AuditLog` gains `org_id` and a `{ org_id, created_at: -1 }` compound index that
backs a keyset-paginated per-org view, plus CSV export. Entries carry action,
actor, resource id, IP, and user agent — metadata only, never secret plaintext
or ciphertext, the same rule the trail already followed. A TTL index expires
rows after `AUDIT_RETENTION_DAYS` (default 365).

## Break-glass

At creation, each org's DEK is also wrapped under a key derived from a one-time
organization recovery key (Crockford base32, the same generator as the account
recovery key) with its own public salt. The owner — and only the owner — can
fetch that envelope, unwrap it locally with the recovery key, and have their
client re-seal the Org DEK to their own identity key. Audited as
`org:break_glass`.

## Known limitations

### Deferred: Org DEK rotation on offboarding

Removing a member deletes their `Membership` row and revokes their refresh
tokens. The Org DEK is **not** rotated. A member who cached the key, or who
copied ciphertext before removal, keeps the ability to decrypt that ciphertext
indefinitely. Revocation is server-side only.

Closing this would require: generate `OrgDEK'`; walk every secret in the org,
decrypting with the old key and re-encrypting under the new one; re-seal
`OrgDEK'` to every remaining member's public key; commit the swap. That job must
be batched and resumable, the org needs a brief write-lock while it runs, and
the API has to tolerate two live key generations during the transition. The
natural trigger is member removal, with a manual "rotate now" action in
Organization settings.

### Public-key substitution

An admin granting access sees the public key the server reports for that member.
A malicious or compromised server could substitute its own key and receive an
Org DEK sealed to it. Nothing else in the design catches this, because every
other channel between the two people runs through that same server.

The mitigation is a 160-bit SHA-256 fingerprint of the public key
(`crypto/identity.rs`), which **both** sides can read:

- the joining member sees their own under **Settings → Your key fingerprint**,
  and again on the waiting-for-access screen right after they accept;
- the granting admin sees the invitee's on the pending-member row and in the
  grant dialog.

Theirs is derived in the Rust core from the secret half they hold, never from
the server's copy — a tampered `wrapped_identity_sk` fails its AEAD check rather
than yielding an attacker-chosen key.

The comparison only works out of band: a voice call where the two recognize each
other, or in person. Email, chat, and Cloak itself are all channels an attacker
holding the server may influence. A mismatch means cancel, not retry.

The width is deliberate. The adversary already controls the server, so they can
grind keypairs offline hunting for a colliding fingerprint; 160 bits puts that
out of reach, where the 64 bits this originally shipped with would not have.

Trust-on-first-use pinning is still not implemented: nothing detects a key that
changes between grants, and nothing forces the admin to perform the comparison.

### Removal logs the member out everywhere

`removeMember` calls `revokeAllForUser`, which invalidates that account's refresh
tokens globally — including for their other organizations. Simple and safe, but
broader than strictly necessary.
