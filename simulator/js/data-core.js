/**
 * Under the Cloak — core data: custody zones, cryptographic primitives, key catalogue.
 *
 * Everything here is traced to the real repository. The `code` field on a record
 * is a path:line into the codebase; when that code moves, update the record.
 * A wrong fact in an onboarding tool is worse than a missing one.
 */
window.Atlas = window.Atlas || {};

Atlas.meta = {
  name: 'Under the Cloak',
  tagline: 'How the keys and locks actually work',
  repo: 'cloak',
  sourceOfTruth: 'docs/INFO_ABOUT_KEYS.md',
};

/* ── Custody zones ──────────────────────────────────────────────────────────
   Where a value can come to rest. Trust decreases left to right, except for
   `ephemeral`, which is a deliberate refusal to store at all.                */
Atlas.zones = [
  {
    id: 'device-ram',
    name: 'Rust process memory',
    short: 'Device RAM',
    custody: 'user',
    blurb:
      'Held inside the Tauri core, wrapped in Zeroizing so the bytes are scrubbed when dropped. Never crosses into the webview, never written to disk.',
    code: 'desktop/src-tauri/src/session/mod.rs:18',
  },
  {
    id: 'webview',
    name: 'Webview memory',
    short: 'Webview',
    custody: 'user',
    blurb:
      'The React layer. Holds ciphertext strings, bearer tokens, and plaintext only while a secret is revealed on screen. Nothing here is persisted.',
    holds: [
      ['Access token', 'JWT, 15 min'],
      ['Refresh token', '32 bytes, rotating'],
      ['Ciphertext strings', 'opaque'],
      ['Revealed plaintext', 'while on screen'],
      ['Last-selected org id', 'localStorage'],
    ],
    code: 'desktop/src/lib/api.ts:74',
  },
  {
    id: 'keychain',
    name: 'OS credential store',
    short: 'Keychain',
    custody: 'os',
    blurb:
      'Keychain on macOS, Credential Manager on Windows, Secret Service on Linux. The only place Cloak persists an unwrapped key, and only for Remember-Me.',
    holds: [
      ['dek_b64', 'the personal DEK, unwrapped'],
      ['refresh_token', 'kept in step with rotation'],
      ['email', 'to resume the session'],
      ['stored_at_ms', 'starts the 30-day clock'],
    ],
    code: 'desktop/src-tauri/src/keystore/mod.rs:29',
  },
  {
    id: 'wire',
    name: 'The wire',
    short: 'Wire',
    custody: 'transit',
    blurb:
      'The HTTPS request body. Exactly one derived secret is designed to travel here: the authHash, which proves identity and decrypts nothing.',
    holds: [
      ['Wrapped envelopes', 'opaque, in transit'],
      ['Join keys', 'encoded, not encrypted'],
    ],
    code: 'api/src/validators/auth.validators.ts:12',
  },
  {
    id: 'mongo',
    name: 'MongoDB',
    short: 'Database',
    custody: 'server',
    blurb:
      'The server stores wrapped envelopes, one-way hashes, and searchable metadata. It holds no key that opens any of it.',
    code: 'api/src/models/user.model.ts',
  },
  {
    id: 'host',
    name: 'Server filesystem',
    short: 'Host .env',
    custody: 'server',
    blurb:
      'Operator territory. Signing secrets and deployment config in plaintext. None of it can decrypt vault data.',
    holds: [
      ['JWT_SECRET', '48 bytes'],
      ['REFRESH_SECRET', 'unused'],
      ['OWNERSHIP_KEY', 'spent on claim'],
      ['HEALTH_TOKEN', '32 bytes'],
      ['MONGODB_URI', 'db credentials'],
      ['RESEND_API_KEY', 'third party'],
    ],
    code: 'api/.env.example',
  },
  {
    id: 'ephemeral',
    name: 'Shown once, stored nowhere',
    short: 'Shown once',
    custody: 'none',
    blurb:
      'Displayed to the user a single time and then dropped from memory. No copy exists in the client, the server, or the database.',
    code: 'desktop/src/stores/auth.ts:193',
  },
];

/* ── Cryptographic primitives ─────────────────────────────────────────────── */
Atlas.primitives = [
  {
    id: 'argon2id',
    name: 'Argon2id',
    role: 'Key derivation',
    verb: 'derive',
    blurb: 'Turns a human secret into 32 key bytes, slowly enough that guessing is expensive.',
    params: [
      ['Version', '0x13'],
      ['Memory cost', '19 456 KiB (19 MiB)'],
      ['Time cost', '2 passes'],
      ['Parallelism', '1 lane'],
      ['Output', '32 bytes'],
      ['Salt', '16 random bytes, base64'],
    ],
    detail:
      'Three domains share one password and salt. The domain label is passed as Argon2’s secret input, so each domain is a distinct keyed hash and the outputs are computationally independent. The label has to enter the KDF rather than be mixed into its output — mixing afterwards would leave every domain a known function of every other, and since the authHash goes to the server on every login, that would hand the server the Master Key.',
    code: 'desktop/src-tauri/src/crypto/kdf.rs:22',
  },
  {
    id: 'xchacha',
    name: 'XChaCha20-Poly1305',
    role: 'Symmetric field cipher',
    verb: 'wrap',
    blurb: 'Encrypts one key with another key, and every secret field in the vault.',
    params: [
      ['Nonce', '24 random bytes per call'],
      ['Tag', '16 bytes, Poly1305'],
      ['Output', 'base64(nonce ‖ ciphertext ‖ tag)'],
    ],
    detail:
      'Every stored ciphertext in Cloak has this exact shape. A fresh random nonce per call means the same plaintext encrypts to a different string on every save. The authentication tag means tampering is detected rather than silently decrypted into garbage.',
    code: 'desktop/src-tauri/src/crypto/aead.rs:16',
  },
  {
    id: 'sealedbox',
    name: 'X25519 sealed box',
    role: 'Asymmetric sharing',
    verb: 'seal',
    blurb: 'Hands a key to one specific person, with no prior key exchange.',
    params: [
      ['Curve', 'Curve25519'],
      ['Cipher', 'XSalsa20-Poly1305'],
      ['Sender key', 'ephemeral, discarded'],
    ],
    detail:
      'The libsodium anonymous sealed-box construction. The sender generates a throwaway keypair, derives a shared secret against the recipient’s public key, encrypts, attaches the ephemeral public key, and discards the ephemeral secret. The consequence is worth sitting with: even the admin who sealed an Org DEK cannot reopen it. Only the recipient can.',
    code: 'desktop/src-tauri/src/crypto/identity.rs:46',
  },
  {
    id: 'ecies',
    name: 'ECIES over secp256k1',
    role: '.env value cipher',
    verb: 'encrypt',
    blurb: 'Encrypts .env values so the real dotenvx CLI can still read them.',
    params: [
      ['Curve', 'secp256k1'],
      ['Scope', 'one keypair per env file'],
      ['Wire form', 'encrypted:BAll…'],
    ],
    detail:
      'Used only for .env files, so Cloak’s output stays byte-compatible with dotenvx and an encrypted .env remains useful outside Cloak. Encryption is value-level: comments, blank lines and variable names survive verbatim, which is what makes an encrypted .env diff-able in git.',
    code: 'desktop/src-tauri/src/crypto/dotenvx_compat.rs:13',
  },
  {
    id: 'pbkdf2',
    name: 'PBKDF2 + AES-256-GCM',
    role: 'Portable backup',
    verb: 'seal',
    blurb: 'The .cloak export envelope, deliberately independent of the vault.',
    params: [
      ['Hash', 'SHA-256'],
      ['Iterations', '210 000'],
      ['Salt', '16 bytes'],
      ['IV', '12 bytes'],
    ],
    detail:
      'Runs in WebCrypto rather than the Rust core, because this envelope never touches a vault key — there is nothing to keep out of the webview. It opens on any device with the passphrase: no vault, no DEK, no server.',
    code: 'desktop/src/lib/vault-export.ts:79',
  },
  {
    id: 'sha256',
    name: 'SHA-256',
    role: 'Token fingerprint',
    verb: 'hash',
    blurb: 'One-way fingerprints for values that already carry full entropy.',
    params: [
      ['Used for', 'refresh, invitation, OTP, ownership'],
      ['Comparison', 'constant-time'],
    ],
    detail:
      'Server-side only. A slow KDF buys nothing against a 32-byte random token, so these get a fast hash. Passwords never take this path — they go through Argon2id.',
    code: 'api/src/lib/hashing.ts:22',
  },
];

/* ── Vocabulary ─────────────────────────────────────────────────────────────
   Four verbs used precisely. Confusing them makes everything else unreadable. */
Atlas.vocabulary = [
  {
    verb: 'derive',
    means: 'Turn a human secret into key bytes',
    primitive: 'Argon2id',
    reversible: 'Anyone with the same input and salt',
  },
  {
    verb: 'wrap',
    means: 'Encrypt one key with another key',
    primitive: 'XChaCha20-Poly1305',
    reversible: 'Holder of the wrapping key',
  },
  {
    verb: 'seal',
    means: "Encrypt to a recipient's public key",
    primitive: 'X25519 sealed box',
    reversible: 'Holder of the matching secret key',
  },
  {
    verb: 'hash',
    means: 'One-way fingerprint, for verification only',
    primitive: 'Argon2id or SHA-256',
    reversible: 'Nobody — you can only re-hash and compare',
  },
];

/* ── Key catalogue ──────────────────────────────────────────────────────────
   kind:  human | derived | random | keypair | envelope | token | config | data
   The `unlocks` / `unlockedBy` edges drive the hierarchy graph and trace mode. */
Atlas.keys = [
  /* -- human secrets -- */
  {
    id: 'master-password',
    name: 'Master password',
    kind: 'human',
    group: 'account',
    size: 'user-chosen',
    zone: 'ephemeral',
    form: 'Never stored, never transmitted',
    produced: 'Typed by the user',
    unlocks: ['master-key', 'auth-hash'],
    unlockedBy: [],
    crossesWire: false,
    summary: 'The root of the everyday path. Feeds two independent Argon2id derivations and is never itself sent anywhere.',
    code: 'desktop/src-tauri/src/commands/crypto.rs:77',
  },
  {
    id: 'recovery-key',
    name: 'Account recovery key',
    kind: 'human',
    group: 'account',
    size: '160 bits',
    zone: 'ephemeral',
    form: 'Shown once on screen, then gone',
    produced: 'generate_recovery_key()',
    unlocks: ['recovery-wk'],
    unlockedBy: [],
    crossesWire: false,
    summary:
      'Eight groups of four Crockford base32 characters. Displayed exactly once after signup. Nothing in Cloak retains a copy — lose it and the password together and the account is unrecoverable by design.',
    detail:
      'Crockford’s alphabet omits I, L, O and U. The normalizer folds O→0, I/L→1, U→V, uppercases, and strips separators, so a user can retype it lowercase with spaces and it still matches.',
    code: 'desktop/src-tauri/src/crypto/kdf.rs:93',
  },
  {
    id: 'org-recovery-key',
    name: 'Org recovery key',
    kind: 'human',
    group: 'org',
    size: '160 bits',
    zone: 'ephemeral',
    form: 'Shown once on screen, then gone',
    produced: 'generate_recovery_key()',
    unlocks: ['org-recovery-wk'],
    unlockedBy: [],
    crossesWire: false,
    summary:
      'The break-glass door into an organization. Its purpose is different from account recovery: it is for an owner who has lost every member device.',
    code: 'desktop/src-tauri/src/crypto/kdf.rs:93',
  },

  /* -- derived -- */
  {
    id: 'master-key',
    name: 'Master Key',
    kind: 'derived',
    group: 'account',
    size: '32 bytes',
    zone: 'device-ram',
    form: 'Plaintext in RAM, zeroized on clear',
    produced: 'Argon2id(password, crypto_salt, secret="cloak:mk")',
    unlocks: ['personal-dek'],
    unlockedBy: ['master-password'],
    crossesWire: false,
    summary:
      'Exists only inside the Rust process. Its single job is wrapping and unwrapping the personal DEK. It never crosses the Tauri boundary, is never written to disk, and is never sent to the server.',
    code: 'desktop/src-tauri/src/crypto/kdf.rs:45',
  },
  {
    id: 'auth-hash',
    name: 'authHash',
    kind: 'derived',
    group: 'account',
    size: '32 bytes → base64',
    zone: 'wire',
    form: 'Plaintext on the wire',
    produced: 'Argon2id(password, crypto_salt, secret="cloak:auth")',
    unlocks: [],
    unlockedBy: ['master-password'],
    crossesWire: true,
    summary:
      'The only derived secret designed to leave the device. It proves identity and decrypts nothing.',
    detail:
      'The authHash and the Master Key come from independent keyed derivations, so holding the authHash reveals nothing about the Master Key and cannot be used to unwrap the DEK. That independence is the hinge of the whole zero-knowledge claim — it is what makes it safe to send this value to a server you do not fully trust. The server hashes it again with Argon2id before storage, so a database leak yields no replayable credential.',
    code: 'desktop/src-tauri/src/crypto/kdf.rs:49',
  },
  {
    id: 'recovery-wk',
    name: 'Recovery wrapping key',
    kind: 'derived',
    group: 'account',
    size: '32 bytes',
    zone: 'device-ram',
    form: 'Plaintext in RAM',
    produced: 'Argon2id(recovery key, crypto_salt, secret="cloak:rk")',
    unlocks: ['personal-dek'],
    unlockedBy: ['recovery-key'],
    crossesWire: false,
    summary: 'The second key to the same box. Opens the recovery envelope around the personal DEK.',
    code: 'desktop/src-tauri/src/crypto/kdf.rs:66',
  },
  {
    id: 'org-recovery-wk',
    name: 'Org recovery wrapping key',
    kind: 'derived',
    group: 'org',
    size: '32 bytes',
    zone: 'device-ram',
    form: 'Plaintext in RAM',
    produced: 'Argon2id(org recovery key, org_recovery_salt, secret="cloak:rk")',
    unlocks: ['org-dek'],
    unlockedBy: ['org-recovery-key'],
    crossesWire: false,
    summary: 'Derived against the org’s own independent salt, not the account salt.',
    code: 'desktop/src-tauri/src/crypto/kdf.rs:66',
  },

  /* -- generated keys -- */
  {
    id: 'personal-dek',
    name: 'Personal DEK',
    kind: 'random',
    group: 'account',
    size: '32 random bytes',
    zone: 'device-ram',
    form: 'Plaintext in RAM; OS keychain if Remember-Me',
    produced: 'generate_dek() — OS CSPRNG',
    unlocks: ['identity-sk'],
    unlockedBy: ['master-key', 'recovery-wk'],
    crossesWire: false,
    summary:
      'Two independent envelopes hold the same 32 bytes: one under the Master Key, one under the recovery wrapping key. That is what makes recovery possible without the server knowing anything.',
    detail:
      'Since teams landed, the personal DEK no longer encrypts vault data. Its only remaining job is wrapping the identity secret key. It also makes a password change cheap — you re-wrap 32 bytes, you never re-encrypt the vault.',
    code: 'desktop/src-tauri/src/crypto/dek.rs:8',
  },
  {
    id: 'identity-pk',
    name: 'Identity public key',
    kind: 'keypair',
    group: 'identity',
    size: '32 bytes, X25519',
    zone: 'mongo',
    form: 'Plaintext — public by design',
    produced: 'generate_identity_keypair()',
    unlocks: [],
    unlockedBy: [],
    crossesWire: true,
    public: true,
    summary:
      'Stored in the clear and served to other members so they can seal an Org DEK to it. A public key encrypts; only the secret half decrypts. Publishing it lets people give you a secret, never take one.',
    code: 'desktop/src-tauri/src/crypto/identity.rs:19',
  },
  {
    id: 'identity-sk',
    name: 'Identity secret key',
    kind: 'keypair',
    group: 'identity',
    size: '32 bytes, X25519',
    zone: 'device-ram',
    form: 'Plaintext in RAM',
    produced: 'generate_identity_keypair()',
    unlocks: ['org-dek'],
    unlockedBy: ['personal-dek'],
    crossesWire: false,
    summary:
      'Wrapped under the personal DEK rather than the Master Key, deliberately: the DEK survives password changes and is already covered by the account recovery envelope, so the identity key inherits both properties for free.',
    code: 'desktop/src-tauri/src/commands/crypto.rs:206',
  },
  {
    id: 'org-dek',
    name: 'Org DEK',
    kind: 'random',
    group: 'org',
    size: '32 random bytes',
    zone: 'device-ram',
    form: 'Plaintext in RAM, one per unlocked org',
    produced: 'generate_dek() — OS CSPRNG',
    unlocks: ['vault-fields', 'dotenvx-sk'],
    unlockedBy: ['identity-sk', 'org-recovery-wk'],
    crossesWire: false,
    keystone: true,
    summary:
      'The key that actually encrypts your data. Held in a per-org map keyed by org id, so a user in three orgs holds three DEKs and each org is cryptographically isolated from the others.',
    detail:
      'Every active member of an org holds the same Org DEK. That means the cryptographic boundary is org membership itself, nothing finer — a viewer and a member can decrypt exactly the same secrets and differ only in what the permission layer lets them write.',
    code: 'desktop/src-tauri/src/commands/crypto.rs:113',
  },
  {
    id: 'dotenvx-sk',
    name: 'dotenvx private key',
    kind: 'keypair',
    group: 'env',
    size: 'secp256k1, hex',
    zone: 'mongo',
    form: 'Wrapped under the Org DEK',
    produced: 'generate_env_keypair() — one per env file',
    unlocks: ['env-values'],
    unlockedBy: ['org-dek'],
    crossesWire: true,
    summary:
      'Nullable. A user who imports an already-encrypted .env without supplying the key gets a view-only record — Cloak stores and versions the blob but cannot decrypt it.',
    code: 'api/src/models/env-file.model.ts',
  },
  {
    id: 'dotenvx-pk',
    name: 'dotenvx public key',
    kind: 'keypair',
    group: 'env',
    size: 'secp256k1, hex',
    zone: 'mongo',
    form: 'Plaintext, inside the blob as DOTENV_PUBLIC_KEY',
    produced: 'generate_env_keypair()',
    unlocks: [],
    unlockedBy: [],
    crossesWire: true,
    public: true,
    summary:
      'Because it is embedded and public, anyone can add or re-encrypt a variable in an env file without being able to read it — the write path needs only the public half.',
    code: 'desktop/src-tauri/src/crypto/dotenvx_compat.rs:34',
  },
  {
    id: 'vault-fields',
    name: 'Secret fields',
    kind: 'data',
    group: 'org',
    size: 'base64(nonce ‖ ct ‖ tag)',
    zone: 'mongo',
    form: 'Ciphertext, opaque to the server',
    produced: 'XChaCha20(Org DEK, plaintext)',
    unlocks: [],
    unlockedBy: ['org-dek'],
    crossesWire: true,
    summary:
      'Credential passwords, API keys, AWS secrets, SSH private keys, platform backup codes. Everything not listed as encrypted is stored in the clear so it can be listed and searched without a decrypt.',
    code: 'desktop/src-tauri/src/commands/crypto.rs:321',
  },
  {
    id: 'env-values',
    name: '.env values',
    kind: 'data',
    group: 'env',
    size: 'encrypted:BAll…',
    zone: 'mongo',
    form: 'ECIES ciphertext per value',
    produced: 'ECIES(dotenvx public key, value)',
    unlocks: [],
    unlockedBy: ['dotenvx-sk'],
    crossesWire: true,
    summary: 'Variable names and comments stay readable; only the right-hand side of each assignment is encrypted.',
    code: 'desktop/src-tauri/src/crypto/dotenvx_compat.rs:34',
  },
];

/* ── Stored envelopes ───────────────────────────────────────────────────────
   What the server actually holds. Every one of these is opaque to it.         */
Atlas.envelopes = [
  {
    field: 'users.wrappedDEK',
    holds: 'Personal DEK',
    wrappedBy: 'Master Key',
    primitive: 'XChaCha20-Poly1305',
    opensWith: 'master-password',
  },
  {
    field: 'users.recovery_wrappedDEK',
    holds: 'Personal DEK',
    wrappedBy: 'Recovery wrapping key',
    primitive: 'XChaCha20-Poly1305',
    opensWith: 'recovery-key',
  },
  {
    field: 'users.wrapped_identity_sk',
    holds: 'Identity secret key',
    wrappedBy: 'Personal DEK',
    primitive: 'XChaCha20-Poly1305',
    opensWith: 'personal-dek',
  },
  {
    field: 'memberships.wrapped_org_dek',
    holds: 'Org DEK',
    wrappedBy: "Member's identity public key",
    primitive: 'X25519 sealed box',
    opensWith: 'identity-sk',
    note: 'One row per member, each sealed independently. The server cannot produce this value.',
  },
  {
    field: 'orgs.org_recovery_wrappedDEK',
    holds: 'Org DEK',
    wrappedBy: 'Org recovery wrapping key',
    primitive: 'XChaCha20-Poly1305',
    opensWith: 'org-recovery-key',
  },
  {
    field: 'env-files.encrypted_dotenvx_key',
    holds: 'dotenvx private key',
    wrappedBy: 'Org DEK',
    primitive: 'XChaCha20-Poly1305',
    opensWith: 'org-dek',
  },
];

/* ── Server-side hashes ─────────────────────────────────────────────────────
   Not encrypted. Not reversible either.                                       */
Atlas.hashes = [
  {
    field: 'users.password_hash',
    of: 'authHash',
    primitive: 'Argon2id',
    why: 'A one-way hash of an already-derived value. Not the password, and not a replayable login token.',
    code: 'api/src/lib/hashing.ts:9',
  },
  {
    field: 'refresh_tokens.token_hash',
    of: 'Refresh token',
    primitive: 'SHA-256',
    why: 'Every refresh spends the token it was called with. Replaying a spent one revokes the whole session.',
    code: 'api/src/services/token.service.ts:67',
  },
  {
    field: 'audit-log.hash',
    of: 'The entry, plus the hash before it',
    primitive: 'SHA-256',
    why: 'Entries form an append-only chain. Editing a row breaks its own hash; deleting one breaks the link at the row after it, so tampering is detectable and locatable.',
    code: 'api/src/lib/audit-hash.ts:53',
  },
  {
    field: 'otps.code_hash',
    of: 'Six-digit OTP',
    primitive: 'SHA-256',
    why: 'Six digits is only 20 bits, so the attempt cap and the TTL do the real work, not the code length.',
    code: 'api/src/services/otp.service.ts:18',
  },
  {
    field: 'invitations.token_hash',
    of: 'Invitation token',
    primitive: 'SHA-256',
    why: 'Bound to one email address and TTL-expired after INVITATION_TTL_DAYS.',
    code: 'api/src/models/invitation.model.ts',
  },
  {
    field: 'deployment.ownership_key_hash',
    of: 'OWNERSHIP_KEY',
    primitive: 'SHA-256',
    why: 'A claim needs both halves at once: the environment file, and reach to this database.',
    code: 'api/src/services/deployment.service.ts:53',
  },
];

/* ── What a database dump reveals in the clear ──────────────────────────── */
Atlas.plaintext = [
  { collection: 'users', fields: ['email', 'name', 'crypto_salt', 'identity_public_key', 'is_verified', 'two_factor_enabled', 'last_login_at'] },
  { collection: 'orgs', fields: ['name', 'owner_id', 'org_recovery_salt'] },
  { collection: 'memberships', fields: ['org_id', 'user_id', 'role', 'status', 'invited_by', 'granted_by', 'timestamps'] },
  { collection: 'invitations', fields: ['org_id', 'email', 'role', 'expires_at'] },
  { collection: 'creds', fields: ['name', 'url', 'username', 'note'], flag: 'username' },
  { collection: 'api-keys', fields: ['label', 'url', 'note'] },
  { collection: 'access-keys', fields: ['title', 'access_key_id', 'note'], flag: 'access_key_id' },
  { collection: 'ssh-keys', fields: ['title', 'key_type', 'format', 'comment', 'note'] },
  { collection: 'platform', fields: ['name', 'note', 'is_used', 'used_at'] },
  { collection: 'env-files', fields: ['label', 'tag', 'variable_count', 'project_id', 'DOTENV_PUBLIC_KEY'] },
  { collection: 'audit-log', fields: ['org', 'actor', 'actor_email', 'action', 'outcome', 'resource', 'target_label', 'context', 'ip', 'user_agent', 'timestamp', 'chain_id', 'seq', 'prev_hash', 'hash'] },
  { collection: 'deployment', fields: ['ownership_key_fingerprint', 'sealed_by_version', 'claimed'] },
];

Atlas.encryptedFields = [
  { collection: 'creds', encrypted: 'password', plain: 'name, url, username, note' },
  { collection: 'api-keys', encrypted: 'key', plain: 'label, url, note' },
  { collection: 'access-keys', encrypted: 'secret_access_key', plain: 'title, access_key_id, note' },
  { collection: 'ssh-keys', encrypted: 'private_key', plain: 'title, key_type, format, comment, note' },
  { collection: 'platform', encrypted: 'backup_codes[].encrypted_code', plain: 'name, note, is_used, used_at' },
  { collection: 'env-files', encrypted: 'content, encrypted_dotenvx_key', plain: 'label, tag, variable_count, project_id' },
];
