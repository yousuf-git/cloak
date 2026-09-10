use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use serde::Serialize;
use tauri::State;
use zeroize::Zeroizing;

use crate::crypto::dek::{
  decrypt_field, encrypt_field, generate_dek, unwrap_dek, wrap_dek,
};
use crate::crypto::identity::{
  fingerprint, generate_identity_keypair, open_sealed, public_key_b64, seal_to_public_key,
};
use crate::crypto::dotenvx_compat::{
  count_variables, decrypt_env_file, decrypt_env_value, encrypt_env_file, encrypt_env_value,
  extract_public_key, generate_env_keypair, reveal_all_env_values, EnvKeypair,
};
use crate::crypto::kdf::{
  auth_hash_b64, derive_master_key, derive_recovery_wrapping_key, generate_crypto_salt_b64,
  generate_recovery_key,
};
use crate::keystore;
use crate::session::CryptoSession;

#[derive(Serialize)]
pub struct SignupCryptoPayload {
  pub crypto_salt_b64: String,
  pub auth_hash_b64: String,
  pub wrapped_dek_b64: String,
  pub recovery_wrapped_dek_b64: String,
  /// One-time recovery key — shown to the user once, never persisted anywhere.
  pub recovery_key: String,
  /// Identity keypair used to receive Org DEKs. The public half is served to
  /// other members; the secret half is wrapped by the personal DEK, so it
  /// survives password changes and rides the existing recovery envelope.
  pub identity_public_key: String,
  pub wrapped_identity_sk_b64: String,
  /// Bootstrap material for the account's default organization.
  pub org: OrgBootstrapPayload,
}

#[derive(Serialize)]
pub struct OrgBootstrapPayload {
  /// Org DEK sealed to the creator's own identity public key.
  pub wrapped_org_dek_b64: String,
  pub org_recovery_salt_b64: String,
  pub org_recovery_wrapped_dek_b64: String,
  /// One-time org recovery key — shown once, never persisted anywhere.
  pub org_recovery_key: String,
}

#[derive(Serialize)]
pub struct RecoveryResetPayload {
  pub crypto_salt_b64: String,
  pub auth_hash_b64: String,
  pub wrapped_dek_b64: String,
  pub recovery_wrapped_dek_b64: String,
}

#[derive(Serialize)]
pub struct IdentityPayload {
  pub identity_public_key: String,
  pub wrapped_identity_sk_b64: String,
}

#[derive(Serialize)]
pub struct AuthDerivationResult {
  pub auth_hash_b64: String,
}

#[derive(Serialize)]
pub struct EnvRevealEntry {
  pub key: String,
  pub value: String,
}

/// Generate signup crypto material client-side (password never leaves the device).
#[tauri::command]
pub fn crypto_prepare_signup(
  password: String,
  crypto_salt_b64: Option<String>,
) -> Result<SignupCryptoPayload, String> {
  let salt = crypto_salt_b64.unwrap_or_else(generate_crypto_salt_b64);
  let master_key = derive_master_key(&password, &salt).map_err(|e| e.to_string())?;
  let auth_hash = auth_hash_b64(&password, &salt).map_err(|e| e.to_string())?;
  let dek = generate_dek();
  let wrapped = wrap_dek(&master_key, &dek).map_err(|e| e.to_string())?;

  // Second envelope: wrap the same DEK with a key derived from a one-time
  // recovery key, so the vault can be recovered without the master password.
  let recovery_key = generate_recovery_key();
  let recovery_wk = derive_recovery_wrapping_key(&recovery_key, &salt).map_err(|e| e.to_string())?;
  let recovery_wrapped = wrap_dek(&recovery_wk, &dek).map_err(|e| e.to_string())?;

  let identity = generate_identity_keypair();
  let wrapped_identity_sk =
    encrypt_field(&dek, &B64.encode(*identity.secret_key)).map_err(|e| e.to_string())?;
  let org = bootstrap_org_material(&identity.public_key_b64)?;

  Ok(SignupCryptoPayload {
    crypto_salt_b64: salt,
    auth_hash_b64: auth_hash,
    wrapped_dek_b64: wrapped,
    recovery_wrapped_dek_b64: recovery_wrapped,
    recovery_key,
    identity_public_key: identity.public_key_b64,
    wrapped_identity_sk_b64: wrapped_identity_sk,
    org,
  })
}

/// Mint an Org DEK and its two envelopes: sealed to the creator's identity key
/// (the everyday path) and wrapped under a one-time org recovery key (the
/// break-glass path for an owner who has lost every member device).
fn bootstrap_org_material(owner_public_key_b64: &str) -> Result<OrgBootstrapPayload, String> {
  let org_dek = generate_dek();
  let wrapped_org_dek =
    seal_to_public_key(owner_public_key_b64, &*org_dek).map_err(|e| e.to_string())?;

  let org_recovery_key = generate_recovery_key();
  let org_recovery_salt = generate_crypto_salt_b64();
  let org_recovery_wk = derive_recovery_wrapping_key(&org_recovery_key, &org_recovery_salt)
    .map_err(|e| e.to_string())?;
  let org_recovery_wrapped = wrap_dek(&org_recovery_wk, &org_dek).map_err(|e| e.to_string())?;

  Ok(OrgBootstrapPayload {
    wrapped_org_dek_b64: wrapped_org_dek,
    org_recovery_salt_b64: org_recovery_salt,
    org_recovery_wrapped_dek_b64: org_recovery_wrapped,
    org_recovery_key,
  })
}

/// Recover the vault with a recovery key and set a new master password.
/// Unwraps the DEK via the recovery envelope, then re-wraps it (and the
/// recovery envelope) under a fresh salt + new master password. Establishes the
/// session on success. The password/recovery key never leave the device.
#[tauri::command]
pub fn crypto_recovery_reset(
  session: State<'_, CryptoSession>,
  recovery_key: String,
  crypto_salt_b64: String,
  recovery_wrapped_dek_b64: String,
  new_password: String,
) -> Result<RecoveryResetPayload, String> {
  let recovery_wk =
    derive_recovery_wrapping_key(&recovery_key, &crypto_salt_b64).map_err(|e| e.to_string())?;
  let dek = unwrap_dek(&recovery_wk, &recovery_wrapped_dek_b64).map_err(|_| {
    "That recovery key doesn't match this account. Check it and try again.".to_string()
  })?;

  let new_salt = generate_crypto_salt_b64();
  let new_master = derive_master_key(&new_password, &new_salt).map_err(|e| e.to_string())?;
  let new_auth = auth_hash_b64(&new_password, &new_salt).map_err(|e| e.to_string())?;
  let new_wrapped = wrap_dek(&new_master, &dek).map_err(|e| e.to_string())?;

  let new_recovery_wk =
    derive_recovery_wrapping_key(&recovery_key, &new_salt).map_err(|e| e.to_string())?;
  let new_recovery_wrapped = wrap_dek(&new_recovery_wk, &dek).map_err(|e| e.to_string())?;

  session.set_master_key(new_master);
  session.set_dek(dek);

  Ok(RecoveryResetPayload {
    crypto_salt_b64: new_salt,
    auth_hash_b64: new_auth,
    wrapped_dek_b64: new_wrapped,
    recovery_wrapped_dek_b64: new_recovery_wrapped,
  })
}

/// Derive only the auth hash for the server login step (no session unlock yet).
/// Used at login before the server returns the wrapped DEK.
#[tauri::command]
pub fn crypto_derive_auth_hash(
  password: String,
  crypto_salt_b64: String,
) -> Result<AuthDerivationResult, String> {
  let auth_hash = auth_hash_b64(&password, &crypto_salt_b64).map_err(|e| e.to_string())?;
  Ok(AuthDerivationResult {
    auth_hash_b64: auth_hash,
  })
}

/// Derive keys from password, store MasterKey in Rust memory, return auth hash for server login.
#[tauri::command]
pub fn crypto_unlock_session(
  session: State<'_, CryptoSession>,
  password: String,
  crypto_salt_b64: String,
  wrapped_dek_b64: String,
) -> Result<AuthDerivationResult, String> {
  let master_key = derive_master_key(&password, &crypto_salt_b64).map_err(|e| e.to_string())?;
  let dek = unwrap_dek(&master_key, &wrapped_dek_b64).map_err(|e| e.to_string())?;
  let auth_hash = auth_hash_b64(&password, &crypto_salt_b64).map_err(|e| e.to_string())?;

  session.set_master_key(master_key);
  session.set_dek(dek);

  Ok(AuthDerivationResult {
    auth_hash_b64: auth_hash,
  })
}

/// Load the identity secret key into the session. Requires an unlocked vault:
/// the key is wrapped by the personal DEK.
#[tauri::command]
pub fn crypto_load_identity(
  session: State<'_, CryptoSession>,
  wrapped_identity_sk_b64: String,
) -> Result<String, String> {
  let secret_b64 = session
    .with_dek(|dek| decrypt_field(dek, &wrapped_identity_sk_b64))
    .map_err(|e| e.to_string())?;
  let secret = decode_secret_key(&secret_b64)?;
  let public = public_key_b64(&secret);
  session.set_identity_sk(secret);
  Ok(public)
}

/// Generate an identity keypair for an account that predates them, wrapping the
/// secret half under the personal DEK. The caller persists both halves.
#[tauri::command]
pub fn crypto_create_identity(
  session: State<'_, CryptoSession>,
) -> Result<IdentityPayload, String> {
  let identity = generate_identity_keypair();
  let wrapped = session
    .with_dek(|dek| encrypt_field(dek, &B64.encode(*identity.secret_key)))
    .map_err(|e| e.to_string())?;
  session.set_identity_sk(identity.secret_key);
  Ok(IdentityPayload {
    identity_public_key: identity.public_key_b64,
    wrapped_identity_sk_b64: wrapped,
  })
}

/// Open a membership's sealed Org DEK with the identity key and hold it for the
/// session, so vault items in that org can be encrypted and decrypted.
#[tauri::command]
pub fn crypto_load_org(
  session: State<'_, CryptoSession>,
  org_id: String,
  wrapped_org_dek_b64: String,
) -> Result<(), String> {
  let opened = session
    .with_identity_sk(|sk| open_sealed(sk, &wrapped_org_dek_b64))
    .map_err(|e| e.to_string())?;
  session.set_org_dek(&org_id, to_dek(&opened)?);
  Ok(())
}

/// Mint a new organization's key material. Requires a loaded identity — the Org
/// DEK is sealed to the creator's own public key.
#[tauri::command]
pub fn crypto_bootstrap_org(
  session: State<'_, CryptoSession>,
) -> Result<OrgBootstrapPayload, String> {
  let public = session
    .with_identity_sk(|sk| Ok(public_key_b64(sk)))
    .map_err(|e| e.to_string())?;
  bootstrap_org_material(&public)
}

/// Seal an org's DEK to a joining member's public key. This is the grant step:
/// neither the server nor the invitee can perform it, so an existing member
/// with the key has to. Verify `fingerprint` out of band first — a substituted
/// public key here would hand the org's secrets to whoever holds its private half.
#[tauri::command]
pub fn crypto_seal_org_dek_for(
  session: State<'_, CryptoSession>,
  org_id: String,
  recipient_public_key_b64: String,
) -> Result<String, String> {
  session
    .with_org_dek(&org_id, |dek| {
      seal_to_public_key(&recipient_public_key_b64, dek)
    })
    .map_err(|e| e.to_string())
}

/// Break-glass: recover an org with its one-time recovery key, then re-seal the
/// Org DEK to the caller's identity so normal access resumes.
#[tauri::command]
pub fn crypto_org_recovery_unlock(
  session: State<'_, CryptoSession>,
  org_id: String,
  org_recovery_key: String,
  org_recovery_salt_b64: String,
  org_recovery_wrapped_dek_b64: String,
) -> Result<String, String> {
  let wrapping_key = derive_recovery_wrapping_key(&org_recovery_key, &org_recovery_salt_b64)
    .map_err(|e| e.to_string())?;
  let org_dek = unwrap_dek(&wrapping_key, &org_recovery_wrapped_dek_b64).map_err(|_| {
    "That recovery key doesn't match this organization. Check it and try again.".to_string()
  })?;

  let public = session
    .with_identity_sk(|sk| Ok(public_key_b64(sk)))
    .map_err(|e| e.to_string())?;
  let resealed = seal_to_public_key(&public, &*org_dek).map_err(|e| e.to_string())?;

  session.set_org_dek(&org_id, org_dek);
  Ok(resealed)
}

#[tauri::command]
pub fn crypto_public_key_fingerprint(public_key_b64: String) -> Result<String, String> {
  fingerprint(&public_key_b64).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn crypto_org_status(session: State<'_, CryptoSession>, org_id: String) -> bool {
  session.with_org_dek(&org_id, |_| Ok(())).is_ok()
}

#[tauri::command]
pub fn crypto_identity_status(session: State<'_, CryptoSession>) -> bool {
  session.has_identity()
}

#[tauri::command]
pub fn crypto_encrypt_field(
  session: State<'_, CryptoSession>,
  org_id: String,
  plaintext: String,
) -> Result<String, String> {
  session
    .with_org_dek(&org_id, |dek| encrypt_field(dek, &plaintext))
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn crypto_decrypt_field(
  session: State<'_, CryptoSession>,
  org_id: String,
  ciphertext_b64: String,
) -> Result<String, String> {
  session
    .with_org_dek(&org_id, |dek| decrypt_field(dek, &ciphertext_b64))
    .map_err(|e| e.to_string())
}

fn decode_secret_key(secret_b64: &str) -> Result<Zeroizing<[u8; 32]>, String> {
  let bytes = B64.decode(secret_b64).map_err(|e| e.to_string())?;
  to_dek(&bytes)
}

fn to_dek(bytes: &[u8]) -> Result<Zeroizing<[u8; 32]>, String> {
  if bytes.len() != 32 {
    return Err("key must be 32 bytes".to_string());
  }
  let mut key = Zeroizing::new([0u8; 32]);
  key.copy_from_slice(bytes);
  Ok(key)
}

#[tauri::command]
pub fn crypto_generate_env_keypair() -> Result<EnvKeypair, String> {
  Ok(generate_env_keypair())
}

#[tauri::command]
pub fn crypto_encrypt_env_value(plaintext: String, public_key_hex: String) -> Result<String, String> {
  encrypt_env_value(&plaintext, &public_key_hex).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn crypto_decrypt_env_value(encrypted: String, private_key_hex: String) -> Result<String, String> {
  decrypt_env_value(&encrypted, &private_key_hex).map_err(|e| e.to_string())
}

#[derive(Serialize)]
pub struct EnvEncryptNewResult {
  pub encrypted_env: String,
  /// dotenvx private key wrapped by the Vault DEK.
  pub wrapped_key_b64: String,
  pub public_key_hex: String,
  pub variable_count: usize,
}

#[derive(Serialize)]
pub struct EnvDecryptResult {
  pub plaintext_env: String,
  pub public_key_hex: Option<String>,
  pub variable_count: usize,
}

#[derive(Serialize)]
pub struct EnvEncryptResult {
  pub encrypted_env: String,
  pub variable_count: usize,
}

/// Plain import: generate a fresh dotenvx keypair, encrypt the whole file, and
/// wrap the private key with the Vault DEK. The private key never leaves Rust
/// unwrapped.
#[tauri::command]
pub fn crypto_env_encrypt_new(
  session: State<'_, CryptoSession>,
  org_id: String,
  plaintext_env: String,
) -> Result<EnvEncryptNewResult, String> {
  let kp = generate_env_keypair();
  let encrypted_env =
    encrypt_env_file(&plaintext_env, &kp.public_key_hex).map_err(|e| e.to_string())?;
  let wrapped_key_b64 = session
    .with_org_dek(&org_id, |dek| encrypt_field(dek, &kp.private_key_hex))
    .map_err(|e| e.to_string())?;
  let variable_count = count_variables(&encrypted_env);

  Ok(EnvEncryptNewResult {
    encrypted_env,
    wrapped_key_b64,
    public_key_hex: kp.public_key_hex,
    variable_count,
  })
}

/// Decrypt a stored env file: unwrap the dotenvx key with the DEK, then decrypt.
#[tauri::command]
pub fn crypto_env_decrypt(
  session: State<'_, CryptoSession>,
  org_id: String,
  encrypted_env: String,
  wrapped_key_b64: String,
) -> Result<EnvDecryptResult, String> {
  let private_key = session
    .with_org_dek(&org_id, |dek| decrypt_field(dek, &wrapped_key_b64))
    .map_err(|e| e.to_string())?;
  let plaintext_env = decrypt_env_file(&encrypted_env, &private_key).map_err(|e| e.to_string())?;

  Ok(EnvDecryptResult {
    public_key_hex: extract_public_key(&encrypted_env),
    variable_count: count_variables(&encrypted_env),
    plaintext_env,
  })
}

/// Re-encrypt an edited env file under an existing public key (edit + save).
#[tauri::command]
pub fn crypto_env_encrypt_existing(
  plaintext_env: String,
  public_key_hex: String,
) -> Result<EnvEncryptResult, String> {
  let encrypted_env =
    encrypt_env_file(&plaintext_env, &public_key_hex).map_err(|e| e.to_string())?;
  let variable_count = count_variables(&encrypted_env);
  Ok(EnvEncryptResult {
    encrypted_env,
    variable_count,
  })
}

/// Encrypted import with a user-supplied key: wrap the provided dotenvx private
/// key with the Vault DEK so the file can be decrypted later.
#[tauri::command]
pub fn crypto_env_wrap_key(
  session: State<'_, CryptoSession>,
  org_id: String,
  private_key_hex: String,
) -> Result<String, String> {
  session
    .with_org_dek(&org_id, |dek| encrypt_field(dek, &private_key_hex))
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn crypto_env_count_variables(env_text: String) -> usize {
  count_variables(&env_text)
}

#[tauri::command]
pub fn crypto_reveal_all_env(
  env_text: String,
  private_key_hex: String,
) -> Result<Vec<EnvRevealEntry>, String> {
  let pairs = reveal_all_env_values(&env_text, &private_key_hex).map_err(|e| e.to_string())?;
  Ok(pairs
    .into_iter()
    .map(|(key, value)| EnvRevealEntry { key, value })
    .collect())
}

#[tauri::command]
pub fn crypto_session_clear(session: State<'_, CryptoSession>) {
  session.clear();
}

#[tauri::command]
pub fn crypto_session_status(session: State<'_, CryptoSession>) -> bool {
  session.is_unlocked()
}

#[derive(Serialize)]
pub struct RememberRestoreResult {
  pub email: String,
  pub refresh_token: String,
}

/// Persist the current session's DEK + refresh token to the OS keychain for
/// 30-day Remember-Me. The DEK is read from Rust memory and never crosses the
/// webview boundary.
#[tauri::command]
pub fn remember_enable(
  session: State<'_, CryptoSession>,
  refresh_token: String,
  email: String,
) -> Result<(), String> {
  let dek_b64 = session.export_dek_b64().map_err(|e| e.to_string())?;
  keystore::save(&dek_b64, &refresh_token, &email)
}

/// On boot: if a valid (<=30d) Remember-Me entry exists, load its DEK into the
/// session and return the refresh token + email so the client can refresh
/// tokens without a password prompt. Returns null otherwise.
#[tauri::command]
pub fn remember_try_restore(
  session: State<'_, CryptoSession>,
) -> Result<Option<RememberRestoreResult>, String> {
  match keystore::restore()? {
    Some(restored) => {
      session
        .load_dek_from_b64(&restored.dek_b64)
        .map_err(|e| e.to_string())?;
      Ok(Some(RememberRestoreResult {
        email: restored.email,
        refresh_token: restored.refresh_token,
      }))
    }
    None => Ok(None),
  }
}

/// Keep a stored Remember-Me entry pointing at the latest refresh token. A
/// no-op when the user did not ask to be remembered.
#[tauri::command]
pub fn remember_update_token(refresh_token: String) -> Result<(), String> {
  keystore::update_refresh_token(&refresh_token)
}

#[tauri::command]
pub fn remember_clear() -> Result<(), String> {
  keystore::clear()
}

#[tauri::command]
pub fn remember_status() -> Result<bool, String> {
  keystore::is_active()
}

#[tauri::command]
pub fn app_version() -> String {
  env!("CARGO_PKG_VERSION").to_string()
}
