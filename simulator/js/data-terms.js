/**
 * Under the Cloak — vocabulary.
 *
 * Definitions written for someone reading the codebase for the first time.
 * Where a term has a general meaning and a narrower Cloak meaning, both are
 * given, because the gap between them is usually where confusion starts.
 */
window.Atlas = window.Atlas || {};

Atlas.glossary = [
  {
    term: 'AEAD',
    expand: 'Authenticated Encryption with Associated Data',
    def: 'Encryption that also proves the ciphertext was not tampered with. Decryption of a modified blob fails loudly instead of returning garbage.',
    seeAlso: 'XChaCha20-Poly1305',
  },
  {
    term: 'Argon2id',
    def: 'The password hashing function Cloak derives keys with. Deliberately slow and memory-hungry, so guessing a password costs real time and real RAM.',
    code: 'desktop/src-tauri/src/crypto/kdf.rs:22',
  },
  {
    term: 'authHash',
    def: 'A derivation of the master password sent to the server to prove identity. It decrypts nothing. Independent of the Master Key, which is what makes it safe to transmit.',
    code: 'desktop/src-tauri/src/crypto/kdf.rs:49',
  },
  {
    term: 'Break-glass',
    def: 'An emergency path that bypasses the normal one. Cloak has two: the account recovery key, and the org recovery key for an owner who has lost every member device.',
  },
  {
    term: 'Ciphertext',
    def: 'Encrypted data. In Cloak every stored ciphertext has the same shape: base64 of nonce, then ciphertext, then authentication tag.',
  },
  {
    term: 'Crockford base32',
    def: 'An alphabet that omits I, L, O and U so a human transcribing a code cannot confuse them with 1 and 0. Used for both recovery keys.',
    code: 'desktop/src-tauri/src/crypto/kdf.rs:93',
  },
  {
    term: 'Curve25519 / X25519',
    def: 'The elliptic curve behind identity keypairs, and the key agreement done on it. Roughly 128-bit security; recovering a secret key from a public one is not feasible.',
  },
  {
    term: 'DEK',
    expand: 'Data Encryption Key',
    def: 'A random key that encrypts actual data, rather than being derived from a password. Cloak has two kinds: the personal DEK and the Org DEK.',
  },
  {
    term: 'Derive',
    def: 'Turn a human secret into key bytes using a KDF. Anyone with the same password and salt derives the same key, which is the point.',
  },
  {
    term: 'Domain separation',
    def: 'Deriving several independent keys from one password by mixing a label into the derivation. The label must enter the KDF, not be applied to its output.',
    code: 'desktop/src-tauri/src/crypto/kdf.rs:22',
  },
  {
    term: 'dotenvx',
    def: 'An external tool and file format for encrypted .env files. Cloak matches its wire format so an encrypted .env stays readable by the real dotenvx CLI.',
    code: 'desktop/src-tauri/src/crypto/dotenvx_compat.rs:13',
  },
  {
    term: 'Envelope encryption',
    def: 'Encrypting a key with another key instead of re-encrypting data. Changing a password re-wraps 32 bytes; the vault itself is never touched.',
  },
  {
    term: 'Ephemeral key',
    def: 'A keypair generated for a single operation and discarded. The sealed box uses one, which is why the sender cannot reopen what they sealed.',
  },
  {
    term: 'Fingerprint',
    def: 'A short digest of a public key, read aloud by two people to confirm they hold the same key. Cloak uses 160 bits as ten groups of four hex characters.',
    code: 'desktop/src-tauri/src/crypto/identity.rs:77',
  },
  {
    term: 'Identity keypair',
    def: 'A per-user X25519 keypair. The public half is published so members can seal Org DEKs to it; the secret half is wrapped under the personal DEK.',
  },
  {
    term: 'Join key',
    def: 'One pasteable string bundling a server URL and an invitation token. Encoding, not encryption — the security is in the token, which is high-entropy, single-use and expiring.',
    code: 'api/src/lib/join-key.ts:15',
  },
  {
    term: 'KDF',
    expand: 'Key Derivation Function',
    def: 'The function that turns a password into key bytes. Cloak uses Argon2id everywhere a human secret is involved.',
  },
  {
    term: 'Master Key',
    def: 'Derived from the master password. Its only job is wrapping and unwrapping the personal DEK. Never stored, never transmitted, scrubbed on logout.',
    code: 'desktop/src-tauri/src/crypto/kdf.rs:45',
  },
  {
    term: 'Nonce',
    expand: 'number used once',
    def: 'Random bytes mixed into each encryption so the same plaintext never produces the same ciphertext twice. Cloak uses 24 bytes, generated fresh per call.',
  },
  {
    term: 'Org DEK',
    def: 'The key that actually encrypts vault data. One per organization, held in memory per unlocked org, so each org is cryptographically isolated from the others.',
  },
  {
    term: 'pending_key',
    def: 'A membership that has been accepted but not yet granted a key. The person can sign in and sees nothing, because no Org DEK has been sealed to them.',
  },
  {
    term: 'Personal DEK',
    def: 'A random 32-byte key held in two envelopes: one under the Master Key, one under the recovery key. Since teams, its only job is wrapping the identity secret key.',
  },
  {
    term: 'Poly1305 tag',
    def: 'The 16-byte authentication tag appended to each ciphertext. A wrong key or a modified blob fails the tag check and decryption errors out.',
  },
  {
    term: 'Recovery key',
    def: 'A 160-bit code shown exactly once. It opens a second envelope around the same DEK, so a forgotten password is survivable without the server knowing anything.',
  },
  {
    term: 'Remember-Me',
    def: 'A 30-day trade: the personal DEK is stored unwrapped in the OS credential store so no password prompt is needed, protected by the operating system instead.',
    code: 'desktop/src-tauri/src/keystore/mod.rs:29',
  },
  {
    term: 'Rotation',
    def: 'Replacing a key or token. Refresh tokens rotate on every use. The Org DEK deliberately does not rotate when a member leaves.',
  },
  {
    term: 'Salt',
    def: 'Public random bytes mixed into a derivation so two users with the same password get different keys. Not a secret; a leaked salt is a non-event.',
  },
  {
    term: 'Seal / sealed box',
    def: "Encrypt to someone's public key with no prior exchange and no keypair of your own. The sender cannot read the result back afterwards.",
    code: 'desktop/src-tauri/src/crypto/identity.rs:46',
  },
  {
    term: 'secp256k1',
    def: 'The curve dotenvx uses for .env value encryption. Different from the X25519 curve used for identity keys, and used for a different job.',
  },
  {
    term: 'Session (refresh-token family)',
    def: 'Every refresh token minted from one sign-in shares a session_id, carried forward by each rotation. That is what makes a signed-in device something you can list and revoke, rather than a chain of unrelated token rows. The access token names it in the sid claim.',
    code: 'api/src/services/token.service.ts:51',
    seeAlso: 'Token reuse detection',
  },
  {
    term: 'Token reuse detection',
    def: 'Rotation makes each refresh token single-use, so presenting a spent one means two parties hold it. Cloak does not merely reject the replay: it revokes the whole session and audits the event. The honest device is signed out too, which is the intended trade.',
    code: 'api/src/services/token.service.ts:86',
    seeAlso: 'Session (refresh-token family)',
  },
  {
    term: 'Tamper-evident log',
    def: 'Each audit entry is hashed together with the hash before it. Editing a row breaks its own hash; deleting one breaks the link at the next row. It proves nobody edited the recorded past — not that the past was recorded, which no single-party log can.',
    code: 'api/src/lib/audit-hash.ts:53',
    seeAlso: 'Hash chain',
  },
  {
    term: 'Hash chain',
    def: 'A sequence where each item commits to the one before it, so any change invalidates everything after it. Cloak keeps one per organization, plus one named `account` for events that belong to a person rather than an org.',
    seeAlso: 'Tamper-evident log',
  },
  {
    term: 'Trust boundary',
    def: "The line between the user's device and everything else. In Cloak exactly one derived secret is designed to cross it, and it decrypts nothing.",
  },
  {
    term: 'TTL index',
    def: 'A MongoDB index that deletes rows once they expire. Backs invitations, OTP codes, refresh tokens and the audit trail.',
  },
  {
    term: 'Wrap',
    def: 'Symmetrically encrypt one key with another key. The result is an envelope: opaque to anyone without the wrapping key.',
  },
  {
    term: 'Zeroizing',
    def: 'A Rust wrapper that overwrites memory when a value is dropped, so key bytes do not linger in RAM after logout.',
    code: 'desktop/src-tauri/src/session/mod.rs:18',
  },
  {
    term: 'Zero-knowledge',
    def: 'The server can operate the product without being able to read what it stores. In Cloak this falls out of where the keys live, not out of a policy.',
  },
];
