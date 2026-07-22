# Teams & Business Roadmap (not yet implemented)

Parked feature direction: multi-user / team support. Captured from a discussion of
where consumer-grade tools (Google Password Manager specifically) fall short for
business use — each gap below is a candidate Cloak feature. Nothing here is
scheduled; v1 remains a single-user vault.

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
| 1 | RBAC | Org/workspace entity with roles (owner / admin / member / read-only) enforced server-side per vault resource | Single user owns all resources (`user_id` scoping only) |
| 2 | Audit trails | Per-org audit views + retention; export for compliance | `AuditLog` model already records metadata-only mutations (`api/src/models/audit-log.model.ts`) — single-user, no UI |
| 3 | Multi-user / delegation | Invitations, membership, admin-managed access; delegated project ownership | None |
| 4 | Secure sharing | Wrap the item DEK for the recipient's public key (asymmetric envelope per member) — keeps zero-knowledge intact; no plaintext ever server-side | Per-user Vault DEK only |
| 5 | Account compromise / offboarding | Org-owned vaults survive member removal; re-wrap DEKs on membership change instead of CSV export/import; break-glass recovery for org owners | Vault dies with the account (recovery key aside) |

## Constraints to respect when designing

- **Zero-knowledge must survive teams.** Sharing = client-side re-wrapping of
  data keys for member public keys. The server must never gain decrypt ability.
- **Offboarding = key rotation.** Removing a member requires re-wrapping (and
  ideally rotating) shared DEKs, not just revoking API access.
- **Audit stays metadata-only.** Never log secret plaintext or ciphertext —
  same rule the existing `AuditLog` follows.

## Marketing angle (when built)

The "Why Cloak" comparison matrix on the web (`web/content/site-content.ts`,
`WHY_MATRIX`) gains team-feature rows (RBAC, audit trails, secure sharing) where
consumer password managers score "no".
