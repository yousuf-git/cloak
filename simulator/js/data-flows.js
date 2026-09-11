/**
 * Under the Cloak — flows, roles, events, risks.
 *
 * A flow is a sequence of steps. Each step names the actor performing it, what
 * gets computed, and where the result lands. Steps are the teaching unit: they
 * are what the flow player walks through one at a time.
 *
 * actor: 'user' | 'device' | 'wire' | 'server'
 */
window.Atlas = window.Atlas || {};

Atlas.flows = [
  {
    id: 'signup',
    name: 'Signup',
    lede: 'One Rust call produces every key the account will ever need. The password never leaves the device.',
    entry: 'User submits email and master password',
    code: 'desktop/src-tauri/src/commands/crypto.rs:77',
    steps: [
      {
        actor: 'user',
        title: 'Email and master password entered',
        detail: 'The password is handed straight to the Rust core. The webview never keeps it.',
      },
      {
        actor: 'device',
        title: 'Generate the public salt',
        compute: 'crypto_salt = random(16 bytes)',
        detail: 'A salt is not a secret. Its job is to make precomputed tables useless by ensuring two users with the same password derive different keys.',
        produces: ['crypto_salt'],
        code: 'desktop/src-tauri/src/crypto/kdf.rs:58',
      },
      {
        actor: 'device',
        title: 'Derive the Master Key',
        compute: 'MasterKey = Argon2id(password, crypto_salt, secret="cloak:mk")',
        detail: 'Stays in Rust memory for the whole session. Never written anywhere.',
        produces: ['master-key'],
        code: 'desktop/src-tauri/src/crypto/kdf.rs:45',
      },
      {
        actor: 'device',
        title: 'Derive the authHash',
        compute: 'authHash = Argon2id(password, crypto_salt, secret="cloak:auth")',
        detail: 'A separate keyed derivation from the same password. Independent of the Master Key, which is what makes it safe to transmit.',
        produces: ['auth-hash'],
        code: 'desktop/src-tauri/src/crypto/kdf.rs:49',
      },
      {
        actor: 'device',
        title: 'Mint the personal DEK',
        compute: 'DEK = random(32 bytes)',
        detail: 'The data key. Random, not derived — so it can outlive any particular password.',
        produces: ['personal-dek'],
        code: 'desktop/src-tauri/src/crypto/dek.rs:8',
      },
      {
        actor: 'device',
        title: 'Wrap the DEK under the Master Key',
        compute: 'wrappedDEK = XChaCha20(MasterKey, DEK)',
        detail: 'The everyday envelope. This is what the server will store.',
        code: 'desktop/src-tauri/src/crypto/dek.rs:14',
      },
      {
        actor: 'device',
        title: 'Mint the recovery key and wrap the DEK again',
        compute: 'recoveryWK = Argon2id(recoveryKey, crypto_salt, secret="cloak:rk")\nrecovery_wrappedDEK = XChaCha20(recoveryWK, DEK)',
        detail: 'A second envelope around the same 32 bytes. Two keys, one box — that is what makes a forgotten password survivable without the server knowing anything.',
        produces: ['recovery-key'],
        code: 'desktop/src-tauri/src/crypto/kdf.rs:93',
      },
      {
        actor: 'device',
        title: 'Generate the identity keypair',
        compute: 'wrapped_identity_sk = XChaCha20(DEK, identity_sk)',
        detail: 'X25519. The public half will be served to other members; the secret half is wrapped under the DEK, so it survives password changes and inherits the recovery envelope.',
        produces: ['identity-pk', 'identity-sk'],
        code: 'desktop/src-tauri/src/crypto/identity.rs:19',
      },
      {
        actor: 'device',
        title: 'Bootstrap the default organization',
        compute: 'OrgDEK = random(32)\nwrapped_org_dek = seal(own identity_pk, OrgDEK)\norg_recovery_wrappedDEK = XChaCha20(orgRecoveryWK, OrgDEK)',
        detail: 'Every account gets an org — a solo user’s Personal Space is an org of one. It is minted with both its envelopes and its own one-time recovery key.',
        produces: ['org-dek', 'org-recovery-key'],
        code: 'desktop/src-tauri/src/commands/crypto.rs:113',
      },
      {
        actor: 'wire',
        title: 'Post the bundle',
        compute: 'POST /auth/signup { email, authHash, crypto_salt,\n  wrappedDEK, recovery_wrappedDEK,\n  identity_public_key, wrapped_identity_sk, org }',
        detail: 'Every secret in this payload is either an opaque envelope or a value that decrypts nothing.',
        code: 'api/src/validators/auth.validators.ts:12',
      },
      {
        actor: 'server',
        title: 'Hash the authHash again and store',
        compute: 'password_hash = argon2id(authHash)',
        detail: 'The server never sees the raw password, and hashes the thing it does see. A database leak yields no replayable credential.',
        code: 'api/src/lib/hashing.ts:9',
      },
      {
        actor: 'server',
        title: 'Create the Org and the owner Membership',
        detail: 'Membership starts as owner with status active, carrying the wrapped_org_dek the client sealed to itself.',
        code: 'api/src/services/org.service.ts',
      },
      {
        actor: 'device',
        title: 'Show both recovery keys once, then wipe',
        detail: 'The account recovery key and the org recovery key are displayed a single time and dropped from memory when the user dismisses the screen. No copy exists anywhere.',
        code: 'desktop/src/stores/auth.ts:193',
      },
    ],
  },

  {
    id: 'login',
    name: 'Login',
    lede: 'The server proves nothing about your keys. It hands back an envelope and the client opens it.',
    entry: 'User submits email and master password',
    code: 'desktop/src-tauri/src/commands/crypto.rs:185',
    steps: [
      {
        actor: 'wire',
        title: 'Fetch the salt for this email',
        detail: 'The salt is public and handed back before authentication — it has to be, because the client cannot derive its authHash without it.',
        code: 'api/src/models/user.model.ts',
      },
      {
        actor: 'device',
        title: 'Derive the authHash only',
        compute: 'authHash = Argon2id(password, crypto_salt, secret="cloak:auth")',
        detail: 'No session unlock yet. This step exists purely to produce a login credential.',
        produces: ['auth-hash'],
        code: 'desktop/src-tauri/src/commands/crypto.rs:173',
      },
      {
        actor: 'wire',
        title: 'POST /auth/login',
        compute: 'POST { email, authHash }',
        detail: 'The one value that crosses the trust boundary.',
      },
      {
        actor: 'server',
        title: 'Verify against the stored hash',
        compute: 'argon2.verify(password_hash, authHash)',
        detail: 'Constant-time verification inside the Argon2 library.',
        code: 'api/src/lib/hashing.ts:13',
      },
      {
        actor: 'server',
        title: 'Two-factor challenge, if enabled',
        compute: 'code = randomInt(6 digits)\nstore sha256(code), TTL + attempt cap',
        detail: 'Six digits is only 20 bits, so the attempt cap and the TTL are doing the real work, not the code length.',
        code: 'api/src/services/otp.service.ts:13',
      },
      {
        actor: 'server',
        title: 'Return the wrapped DEK and tokens',
        compute: '{ wrappedDEK, accessToken (15m, sid), refreshToken }',
        detail:
          'The server hands over an envelope it cannot open, plus the session tokens. Both carry a session id: the refresh row stores it, the access token claims it as sid, and every later rotation keeps it \u2014 so one sign-in stays one revocable thing rather than a chain of unrelated rows.',
        code: 'api/src/services/token.service.ts:51',
      },
      {
        actor: 'device',
        title: 'Re-derive the Master Key and unwrap',
        compute: 'MasterKey = Argon2id(password, crypto_salt, secret="cloak:mk")\nDEK = unwrap(MasterKey, wrappedDEK)',
        detail: 'If the password is wrong the Poly1305 tag fails and the unwrap errors — there is no partial success.',
        produces: ['master-key', 'personal-dek'],
        code: 'desktop/src-tauri/src/crypto/dek.rs:18',
      },
      {
        actor: 'device',
        title: 'Load the identity key',
        compute: 'identity_sk = decrypt_field(DEK, wrapped_identity_sk)',
        detail: 'Requires an already-unlocked vault, since the DEK is the unwrapping key.',
        produces: ['identity-sk'],
        code: 'desktop/src-tauri/src/commands/crypto.rs:206',
      },
      {
        actor: 'device',
        title: 'Open each org',
        compute: 'OrgDEK = open_sealed(identity_sk, membership.wrapped_org_dek)',
        detail: 'One per membership. Each lands in the per-org map in session memory, and the vault becomes readable.',
        produces: ['org-dek'],
        code: 'desktop/src-tauri/src/commands/crypto.rs:239',
      },
    ],
  },

  {
    id: 'recovery',
    name: 'Account recovery',
    lede: 'The password changes. The DEK does not — so nothing has to be re-encrypted.',
    entry: 'User has lost the master password but holds the recovery key',
    code: 'desktop/src-tauri/src/commands/crypto.rs:137',
    steps: [
      {
        actor: 'wire',
        title: 'Start recovery',
        detail: 'The server emails a six-digit code. This proves mailbox ownership and nothing else.',
        code: 'api/src/services/otp.service.ts:13',
      },
      {
        actor: 'server',
        title: 'Verify the code, issue a short-lived token',
        compute: 'recoveryToken = JWT({ email, purpose: "recovery" }, 10m)',
        detail: 'The verifier rejects any token without purpose:"recovery", so an access token cannot be substituted for one. Holding it does not grant vault access — it only authorizes committing a rotation the client has already performed.',
        code: 'api/src/lib/jwt.ts:26',
      },
      {
        actor: 'server',
        title: 'Hand back the recovery envelope',
        compute: '{ crypto_salt, recovery_wrappedDEK }',
        detail: 'Still opaque. The server is handing over a locked box to someone it has only confirmed owns the mailbox.',
      },
      {
        actor: 'device',
        title: 'Open the box with the recovery key',
        compute: 'recoveryWK = Argon2id(recoveryKey, old_salt, secret="cloak:rk")\nDEK = unwrap(recoveryWK, recovery_wrappedDEK)',
        detail: 'A wrong recovery key fails the authentication tag. The error message is deliberately specific: that recovery key does not match this account.',
        produces: ['personal-dek'],
        code: 'desktop/src-tauri/src/crypto/kdf.rs:66',
      },
      {
        actor: 'device',
        title: 'Mint a fresh salt and rebuild both envelopes',
        compute: 'new_salt = random(16)\nnew_MasterKey = Argon2id(newPassword, new_salt, "cloak:mk")\nnew_authHash  = Argon2id(newPassword, new_salt, "cloak:auth")\nnew_wrappedDEK = XChaCha20(new_MasterKey, DEK)\nnew_recovery_wrappedDEK = XChaCha20(new_recoveryWK, DEK)',
        detail: 'The salt rotates on every reset, which is why both envelopes have to be rebuilt together.',
        produces: ['master-key', 'auth-hash'],
      },
      {
        actor: 'server',
        title: 'Commit the rotation',
        detail: 'Updates crypto_salt, password_hash, wrappedDEK and recovery_wrappedDEK. The server rotates envelopes it still cannot open.',
        code: 'api/src/services/auth.service.ts:377',
      },
      {
        actor: 'device',
        title: 'Everything downstream still works',
        detail: 'The DEK is unchanged, so the identity key, every Org DEK and every encrypted field remain valid. Nothing is re-encrypted. The recovery key itself is not rotated — the same one still works, re-derived against the new salt.',
      },
    ],
  },

  {
    id: 'grant',
    name: 'Granting a member access',
    lede: 'The server physically cannot add a member. Someone who already holds the key has to.',
    entry: 'An admin invites a new teammate',
    code: 'desktop/src-tauri/src/commands/crypto.rs:268',
    steps: [
      {
        actor: 'server',
        title: 'Create the invitation',
        compute: 'store sha256(token), bound to one email, TTL 7 days',
        detail: 'Only a hash of the emailed token is stored, the same treatment refresh tokens get.',
        code: 'api/src/models/invitation.model.ts',
      },
      {
        actor: 'wire',
        title: 'Email a join key',
        compute: 'cloak_<base64url({ u: serverUrl, t: token })>',
        detail: 'This is encoding, not encryption — anyone intercepting it can base64-decode it. The security comes from the token inside: high entropy, bound to one email, expiring.',
        code: 'api/src/lib/join-key.ts:15',
      },
      {
        actor: 'server',
        title: 'Invitee accepts',
        compute: 'Membership { status: "pending_key", wrapped_org_dek: null }',
        detail: 'They can log in now, and they see nothing. There is no key sealed to them yet and the server has none to give.',
        code: 'api/src/services/org.service.ts',
      },
      {
        actor: 'device',
        title: 'Admin fetches the invitee’s public key',
        detail: 'The server answers with identity_public_key. Note what has just happened: the admin is trusting the server’s claim about whose key this is.',
        code: 'api/src/services/org.service.ts:222',
      },
      {
        actor: 'user',
        title: 'Compare fingerprints out of band',
        compute: 'SHA-256(pubkey)[:20] → 10 groups of 4 hex',
        detail: 'The defence against a substituted key. Both people read it aloud over a channel the server does not control. This step is advisory — the UI shows the fingerprint, nothing forces the comparison.',
        risk: 'pubkey-substitution',
        code: 'desktop/src-tauri/src/crypto/identity.rs:77',
      },
      {
        actor: 'device',
        title: 'Seal the Org DEK to that public key',
        compute: 'sealed = seal_to_public_key(invitee_pk, OrgDEK)',
        detail: 'An ephemeral keypair is generated, used, and discarded. The admin who performs this cannot reopen the result — only the invitee can.',
        code: 'desktop/src-tauri/src/crypto/identity.rs:46',
      },
      {
        actor: 'server',
        title: 'Record the grant',
        compute: 'Membership { wrapped_org_dek, status: "active",\n  granted_by, granted_at }',
        detail: 'The grant is recorded separately from the invite and the accept, because it is the moment they actually gained read access.',
        code: 'api/src/services/org.service.ts:292',
      },
      {
        actor: 'device',
        title: 'Invitee opens it',
        compute: 'OrgDEK = open_sealed(their identity_sk, wrapped_org_dek)',
        detail: 'The vault becomes readable on their device. At no point did the Org DEK exist in the clear anywhere but the two members’ machines.',
      },
    ],
  },

  {
    id: 'envfile',
    name: 'Importing a .env file',
    lede: 'A different cipher, for one reason: the output has to stay readable by the real dotenvx CLI.',
    entry: 'User imports a plaintext .env',
    code: 'desktop/src-tauri/src/commands/crypto.rs:397',
    steps: [
      {
        actor: 'device',
        title: 'Generate a keypair for this file',
        compute: 'keypair = secp256k1()',
        detail: 'Fresh per file. Keys are never shared between env files.',
        produces: ['dotenvx-pk', 'dotenvx-sk'],
        code: 'desktop/src-tauri/src/crypto/dotenvx_compat.rs:13',
      },
      {
        actor: 'device',
        title: 'Encrypt each value with the public key',
        compute: 'DATABASE_URL=postgres://x\n  ↓\nDATABASE_URL="encrypted:BAllx3…"',
        detail: 'Value-level, not file-level. Comments, blank lines and variable names are preserved verbatim, which is what makes an encrypted .env diff-able in git.',
        produces: ['env-values'],
        code: 'desktop/src-tauri/src/crypto/dotenvx_compat.rs:34',
      },
      {
        actor: 'device',
        title: 'Write the public key into the blob',
        compute: 'DOTENV_PUBLIC_KEY="03a1…"',
        detail: 'Embedded and public. A consequence worth knowing: anyone can add or re-encrypt a variable in the file without being able to read it.',
      },
      {
        actor: 'device',
        title: 'Wrap the private key under the Org DEK',
        compute: 'encrypted_dotenvx_key = XChaCha20(OrgDEK, private_key_hex)',
        detail: 'The private key never leaves Rust unwrapped.',
        code: 'desktop/src-tauri/src/commands/crypto.rs:456',
      },
      {
        actor: 'server',
        title: 'Store blob and wrapped key',
        compute: 'EnvFile { content, encrypted_dotenvx_key, variable_count }',
        detail: 'encrypted_dotenvx_key is nullable. Importing an already-encrypted .env without the private key gives a view-only record: Cloak stores and versions it but cannot decrypt it.',
        code: 'api/src/models/env-file.model.ts',
      },
    ],
  },

  {
    id: 'breakglass',
    name: 'Org break-glass',
    lede: 'For an owner who has lost every member device. Without it the org would be permanently dark.',
    entry: 'Owner holds the org recovery key and nothing else',
    code: 'desktop/src-tauri/src/commands/crypto.rs:283',
    steps: [
      {
        actor: 'server',
        title: 'Hand back the org recovery envelope',
        compute: '{ org_recovery_salt, org_recovery_wrappedDEK }',
        detail: 'Requires the org:own capability. The envelope is opaque to the server, as always.',
        code: 'api/src/controllers/org.controller.ts:160',
      },
      {
        actor: 'device',
        title: 'Derive the wrapping key and open',
        compute: 'wk = Argon2id(orgRecoveryKey, org_recovery_salt, secret="cloak:rk")\nOrgDEK = unwrap(wk, org_recovery_wrappedDEK)',
        detail: 'The org salt is independent of the account salt — this path does not touch the user’s password at all.',
        produces: ['org-dek'],
      },
      {
        actor: 'device',
        title: 'Re-seal to the caller’s own identity',
        compute: 'resealed = seal_to_public_key(own identity_pk, OrgDEK)',
        detail: 'So that normal access resumes rather than requiring the recovery key on every subsequent login.',
      },
      {
        actor: 'server',
        title: 'Restore the membership',
        detail: 'Writes the new wrapped_org_dek and records an org:break_glass audit entry.',
        code: 'api/src/controllers/org.controller.ts:165',
      },
    ],
  },
];

/* ── Roles ────────────────────────────────────────────────────────────────── */
Atlas.roles = {
  note:
    'These are authorization rules, not cryptographic ones. Every active member of an org holds the same Org DEK, so a viewer and a member can decrypt exactly the same secrets — they differ only in what this layer lets them write. The cryptographic boundary is org membership itself, nothing finer.',
  code: 'api/src/lib/permissions.ts',
  actions: [
    { id: 'vault:read', label: 'Read vault', blurb: 'List and decrypt every secret in the org.' },
    { id: 'vault:write', label: 'Write vault', blurb: 'Create, edit and delete vault items.' },
    { id: 'member:manage', label: 'Manage members', blurb: 'Invite, grant keys, change roles, remove.' },
    { id: 'audit:read', label: 'Read audit', blurb: 'View and export the org audit trail.' },
    { id: 'org:manage', label: 'Manage org', blurb: 'Rename the organization.' },
    { id: 'org:own', label: 'Own org', blurb: 'Transfer ownership, delete the org, break-glass.' },
  ],
  matrix: {
    viewer: ['vault:read'],
    member: ['vault:read', 'vault:write'],
    admin: ['vault:read', 'vault:write', 'member:manage', 'audit:read', 'org:manage'],
    owner: ['vault:read', 'vault:write', 'member:manage', 'audit:read', 'org:manage', 'org:own'],
  },
  rank: { viewer: 0, member: 1, admin: 2, owner: 3 },
  rankNote: 'Ranking stops an admin from acting on someone at or above their own level.',
};

/* ── Membership lifecycle ─────────────────────────────────────────────────── */
Atlas.membershipStates = [
  {
    id: 'invited',
    name: 'Invited',
    blurb: 'An Invitation row exists, bound to one email, hashed and TTL-expiring. No Membership yet.',
    canRead: false,
  },
  {
    id: 'pending_key',
    name: 'pending_key',
    blurb: 'They accepted. A Membership exists with wrapped_org_dek = null. They can sign in and see nothing.',
    canRead: false,
  },
  {
    id: 'active',
    name: 'active',
    blurb: 'A member sealed the Org DEK to their public key. This is the moment they gained read access.',
    canRead: true,
  },
  {
    id: 'removed',
    name: 'Removed',
    blurb: 'The Membership row and its wrapped_org_dek are deleted, and they are logged out everywhere. The Org DEK is not rotated.',
    canRead: false,
    risk: 'no-rotation',
  },
];

/* ── Auth state machine (desktop client) ──────────────────────────────────── */
Atlas.authStates = [
  { id: 'booting', blurb: 'Checking for a Remember-Me entry in the OS keychain.' },
  { id: 'locked', blurb: 'The sign-in screen. No keys in memory.' },
  { id: 'awaiting_verification', blurb: 'Email ownership not yet proven.' },
  { id: 'awaiting_2fa', blurb: 'Password accepted, six-digit code outstanding.' },
  { id: 'show_recovery_key', blurb: 'Post-signup. The only moment the recovery keys exist on screen.' },
  { id: 'recovery_email', blurb: 'Recovery started, asking for the mailbox.' },
  { id: 'recovery_code', blurb: 'Waiting on the emailed code.' },
  { id: 'recovery_reset', blurb: 'Code accepted; asking for the recovery key and a new password.' },
  { id: 'unlocked', blurb: 'DEK in session memory. Org DEKs loaded. The vault is readable.' },
];

/* ── Audit events ─────────────────────────────────────────────────────────── */
Atlas.events = {
  note:
    'Metadata only — never secret plaintext or ciphertext. Each entry records org, actor (id and the address as it read at the time), action, outcome, resource, the target\u2019s human name, a small flat context map, IP, user agent and timestamp. Entries are chained: each hashes together with the hash before it, so an edit or a deletion is detectable. Rows auto-purge via a TTL index set by AUDIT_RETENTION_DAYS.',
  code: 'api/src/services/audit.service.ts',
  groups: [
    {
      name: 'Authentication',
      actions: [
        { id: 'auth:signup', blurb: 'A new account was created.' },
        { id: 'auth:login', blurb: 'Password accepted and a session issued.' },
        { id: 'auth:login:2fa_challenge', blurb: 'Password accepted; a code was sent.' },
        { id: 'auth:2fa', blurb: 'A two-factor code was accepted.' },
        { id: 'auth:2fa_enabled', blurb: 'Two-factor turned on.' },
        { id: 'auth:2fa_disabled', blurb: 'Two-factor turned off.' },
        { id: 'auth:verify_email', blurb: 'Mailbox ownership proven.' },
        { id: 'auth:logout', blurb: 'Session ended and keys zeroized.' },
        { id: 'auth:recovery:start', blurb: 'Recovery begun; a code was sent.' },
        { id: 'auth:recovery:verify', blurb: 'A recovery code was checked.' },
        { id: 'auth:recovery:reset', blurb: 'Envelopes rotated under a new password.' },
        { id: 'auth:session_revoke', blurb: 'One signed-in device was cut off.' },
        { id: 'auth:session_revoke_all', blurb: 'Every device but the caller\u2019s was signed out.' },
        {
          id: 'auth:refresh_reuse',
          blurb: 'A spent refresh token was presented again, so the whole session was revoked.',
          weight: 'high',
        },
        { id: 'user:rename', blurb: 'A display name was changed.' },
      ],
    },
    {
      name: 'Organization',
      actions: [
        { id: 'org:create', blurb: 'A new organization was minted.' },
        { id: 'org:rename', blurb: 'The organization was renamed.' },
        { id: 'org:delete', blurb: 'The organization was deleted.' },
        { id: 'org:transfer', blurb: 'Ownership moved to another member.' },
        {
          id: 'org:break_glass_start',
          blurb: 'The recovery envelope was handed out \u2014 the half an attacker would stop at.',
          weight: 'high',
        },
        { id: 'org:break_glass', blurb: 'The org recovery key was redeemed.', weight: 'high' },
        { id: 'user:rename', blurb: 'A display name changed.' },
      ],
    },
    {
      name: 'Membership',
      actions: [
        { id: 'member:invite', blurb: 'An invitation was issued.' },
        { id: 'member:invite_revoke', blurb: 'A pending invitation was revoked.' },
        { id: 'member:accept', blurb: 'An invitation was accepted. Status is pending_key.' },
        { id: 'member:grant', blurb: 'The Org DEK was sealed to a member. This is when they gained read access.', weight: 'high' },
        { id: 'member:role_change', blurb: 'A role was changed.' },
        { id: 'member:remove', blurb: 'A member lost access to this org. Their sessions elsewhere are untouched.', weight: 'high' },
      ],
    },
    {
      name: 'Vault',
      actions: [
        { id: 'cred:create', blurb: 'Credential added.' },
        { id: 'cred:update', blurb: 'Credential edited.' },
        { id: 'cred:delete', blurb: 'Credential removed.' },
        { id: 'apikey:create', blurb: 'API key added.' },
        { id: 'apikey:update', blurb: 'API key edited.' },
        { id: 'apikey:delete', blurb: 'API key removed.' },
        { id: 'accesskey:create', blurb: 'Access key added.' },
        { id: 'accesskey:update', blurb: 'Access key edited.' },
        { id: 'accesskey:delete', blurb: 'Access key removed.' },
        { id: 'sshkey:create', blurb: 'SSH key added.' },
        { id: 'sshkey:update', blurb: 'SSH key edited.' },
        { id: 'sshkey:delete', blurb: 'SSH key removed.' },
        { id: 'platform:create', blurb: 'Platform added.' },
        { id: 'platform:update', blurb: 'Platform edited.' },
        { id: 'platform:delete', blurb: 'Platform removed.' },
        { id: 'platform:codes_add', blurb: 'Backup codes added.' },
        { id: 'platform:code_used', blurb: 'A backup code was marked used.' },
        { id: 'platform:code_delete', blurb: 'A backup code was removed.' },
        { id: 'env:create', blurb: 'Env file imported.' },
        { id: 'env:view', blurb: 'Env file decrypted for viewing.' },
        { id: 'env:update', blurb: 'Env file edited.' },
        { id: 'env:delete', blurb: 'Env file removed.' },
        { id: 'project:create', blurb: 'Project added.' },
        { id: 'project:update', blurb: 'Project edited.' },
        { id: 'project:delete', blurb: 'Project removed.' },
        { id: 'audit:export', blurb: 'The audit trail was exported as CSV.' },
      ],
    },
  ],
};

/* ── Known weaknesses ─────────────────────────────────────────────────────── */
Atlas.risks = [
  {
    id: 'pubkey-substitution',
    name: 'Public-key substitution by a malicious server',
    severity: 'inherent',
    summary:
      'When an admin seals the Org DEK to a new member, the admin has only the server’s word for which public key belongs to that person.',
    mechanism:
      'A malicious server can answer the "what is their public key" question with a key it controls. The admin seals the org’s secrets to the attacker, and everything looks normal from both sides.',
    defence:
      'The 160-bit fingerprint, compared out of band. It is deliberately wide: the adversary already controls the server, so they can grind keypairs offline hunting for a collision, and the width has to make that search hopeless rather than merely expensive.',
    residual:
      'The comparison is advisory. The UI shows the fingerprint; nothing enforces that the two parties actually read it to each other.',
    code: 'desktop/src-tauri/src/crypto/identity.rs:77',
  },
  {
    id: 'no-rotation',
    name: 'The Org DEK is not rotated when a member is removed',
    severity: 'operational',
    summary:
      'Removing a member deletes their sealed copy and logs them out, but the Org DEK itself is unchanged.',
    mechanism:
      'A removed member who kept a copy of the DEK — or of any ciphertext plus the DEK — can still decrypt anything that existed while they had access.',
    defence:
      'Removal hands the admin an exposure report instead: every secret the member could open, named, with the ones the trail shows they actually opened sorted first. Rotation would mean re-encrypting every field in the org and re-sealing to every remaining member; it is explicitly deferred.',
    residual:
      'Rotate the underlying secrets themselves \u2014 the actual AWS key, the actual database password \u2014 at the provider that issued them. A secret that has been read cannot be un-read, and re-encrypting the copy in Cloak does not reach the copy in someone\u2019s notes.',
    code: 'api/src/services/offboarding.service.ts:48',
  },
  {
    id: 'remember-me',
    name: 'Remember-Me trades the password for the OS keychain',
    severity: 'by-design',
    summary:
      'For 30 days on that device, the personal DEK sits unwrapped in the OS credential store.',
    mechanism:
      'Anyone with that unlocked user session — malware, or someone at the keyboard — can read it. The window runs from when the user chose to trust the device, not from the last token rotation.',
    defence:
      'The DEK is read out of Rust memory and written directly to the platform store; it never crosses into the webview. Expired and malformed entries are purged on read.',
    residual: 'A deliberate trade, not a defect. It should be a conscious one.',
    code: 'desktop/src-tauri/src/keystore/mod.rs:29',
  },
  {
    id: 'metadata',
    name: 'Plaintext metadata is more revealing than it looks',
    severity: 'by-design',
    summary:
      'Usernames, access key IDs, env file labels and variable counts, org membership and roles are all in the clear.',
    mechanism:
      'A database dump yields no passwords, but it does yield a complete map of an organization’s infrastructure and who can reach it: which services each team uses, under which usernames, which env files exist and how large they are.',
    defence:
      'These fields are plaintext so the client can list, search and sort without decrypting everything first.',
    residual: 'Worth stating plainly to anyone assessing the threat model, because the instinct is to assume usernames are encrypted.',
    code: 'api/src/models/cred.model.ts',
  },
  {
    id: 'refresh-secret',
    name: 'REFRESH_SECRET is required but never used',
    severity: 'cleanup',
    summary:
      'The server refuses to start without a 32-character REFRESH_SECRET, and then nothing reads it.',
    mechanism:
      'Refresh tokens are opaque random strings hashed with SHA-256, not signed JWTs. The variable is dead configuration that setup.sh faithfully generates.',
    defence: 'None needed — it is inert.',
    residual:
      'Harmless, but it misleads an operator into thinking refresh tokens are signed, and into believing that rotating it will do something.',
    code: 'api/src/config/index.ts:12',
  },
];

/* ── Loss matrix ──────────────────────────────────────────────────────────── */
Atlas.lossMatrix = [
  { lost: 'Master password', consequence: 'Cannot unwrap wrappedDEK', recovery: 'Account recovery key plus an emailed code', fatal: false },
  { lost: 'Account recovery key', consequence: 'Nothing, while you still know the password', recovery: 'Sign in as normal', fatal: false },
  { lost: 'Both of the above', consequence: 'The personal vault is unrecoverable', recovery: 'None. By design.', fatal: true },
  { lost: 'Your device', consequence: 'Nothing — keys are re-derivable from the password', recovery: 'Sign in elsewhere', fatal: false },
  { lost: 'Every member device in an org', consequence: 'Org data locked', recovery: 'Org recovery key', fatal: false },
  { lost: 'Org recovery key and all member devices', consequence: 'Org data unrecoverable', recovery: 'None. By design.', fatal: true },
  { lost: 'env-files.encrypted_dotenvx_key', consequence: 'That file becomes view-only ciphertext', recovery: 'Re-import with the private key', fatal: false },
  { lost: 'JWT_SECRET (rotated)', consequence: 'All sessions invalidated', recovery: 'Users sign in again', fatal: false },
  { lost: 'OWNERSHIP_KEY before claiming', consequence: 'Cannot create the first owner', recovery: 'Edit .env and restart, while unclaimed', fatal: false },
  { lost: 'OWNERSHIP_KEY after claiming', consequence: 'Nothing — it is already spent', recovery: 'Delete it from .env', fatal: false },
  { lost: 'The whole database', consequence: 'Vaults are unrecoverable from clients alone', recovery: 'Restore from backup', fatal: true },
];

/* ── Server deployment secrets ────────────────────────────────────────────── */
Atlas.serverSecrets = [
  { name: 'JWT_SECRET', size: '48 bytes', purpose: 'Signs access and recovery tokens', rotation: 'Logs every user out' },
  { name: 'REFRESH_SECRET', size: '48 bytes', purpose: 'Nothing — currently unused', rotation: 'No effect', risk: 'refresh-secret' },
  { name: 'OWNERSHIP_KEY', size: '32 bytes', purpose: 'Claims the first owner of a fresh deployment', rotation: 'Accepted while unclaimed; ignored after' },
  { name: 'HEALTH_TOKEN', size: '32 bytes', purpose: 'Unlocks the detailed status page without a session', rotation: 'No effect' },
];
