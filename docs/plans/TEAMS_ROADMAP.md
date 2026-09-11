# Teams & Business Roadmap (implemented)

Multi-user / team support. Captured from a discussion of where consumer-grade
tools (Google Password Manager specifically) fall short for business use — each
gap below became a Cloak feature.

**Status: built.** See `docs/TEAMS_ARCHITECTURE.md` for how it works and what it
deliberately does not do (notably: removing a member does not rotate the
organization key). `docs/plans/TEAMS_IMPLEMENTATION_PLAN.md` records the plan this was
built from.

## Why consumer password managers fail teams

Free tools like Google Password Manager appeal to small teams, startups, and
freelancers on convenience and price, but they are designed for individuals:

1. **No Role-Based Access Control (RBAC).** No centralized admin console to
   assign access by role — limiting who can view, edit, or share credentials —
   so businesses can't enforce appropriate access to sensitive information.
2. **No activity logging or audit trails.** No visibility into who accessed
   which credentials and when, making usage monitoring and compliance
   effectively impossible.
3. **No multi-user management or delegated access.** No way for an
   administrator to manage user access or delegate permissions across a team.
4. **No secure team password sharing.** Sharing exists only within a "family
   group"; teams fall back to insecure workarounds (email, chat).
5. **Everything is bound to one personal account.** A compromised Google
   account exposes every saved password, and credentials can't be securely
   transferred when an employee leaves — only exported to CSV and re-imported.

## Candidate Cloak features (mapped)

| # | Gap | Cloak candidate | Current state |
|---|-----|-----------------|---------------|
| 1 | RBAC | Org entity with roles (owner / admin / member / viewer) enforced server-side | Built — `api/src/lib/permissions.ts`, `api/src/middlewares/require-org.ts` |
| 2 | Audit trails | Per-org audit view + retention + CSV export | Built, then deepened — entries name what was touched and whether it succeeded, and chain together so tampering is detectable (`docs/plans/SESSIONS_AND_AUDIT_PLAN.md`) |
| 3 | Multi-user / delegation | Invitations, membership, admin-managed access, ownership transfer | Built — `api/src/services/{org,invitation}.service.ts`, Team page |
| 4 | Secure sharing | Org DEK sealed to each member's X25519 public key, client-side only | Built — `desktop/src-tauri/src/crypto/identity.rs` |
| 5 | Account compromise / offboarding | Org-owned vaults survive member removal; break-glass recovery for owners | Built — removal ends org access and hands the admin a rotate-at-the-source checklist of what the member could read (`GET /orgs/:id/members/:userId/exposure`). The Org DEK is not rotated; see "Offboarding" in `docs/TEAMS_ARCHITECTURE.md` |

## Constraints to respect when designing

- **Zero-knowledge must survive teams.** Sharing = client-side re-wrapping of
  data keys for member public keys. The server must never gain decrypt ability.
- **Offboarding = rotate the secrets, not just the envelope.** Removing a member
  ends their org access immediately, and the removal dialog lists what they
  could read so those secrets get rotated at the providers that issued them —
  which is the step that actually retires a credential someone has seen. The Org
  DEK itself is not rotated; the reasoning and the cheaper structural route are
  in `docs/TEAMS_ARCHITECTURE.md`.
- **Audit stays metadata-only.** Never log secret plaintext or ciphertext —
  same rule the existing `AuditLog` follows.

## Marketing angle

The "Why Cloak" comparison matrix on the web (`web/content/site-content.ts`,
`WHY_MATRIX`) carries team-feature rows (RBAC, audit trails, secure team
sharing) where consumer password managers score "no".
