use argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use rand::RngCore;
use zeroize::Zeroizing;

use super::error::{CryptoError, CryptoResult};

const MASTER_KEY_AD: &[u8] = b"cloak:mk";
const AUTH_HASH_AD: &[u8] = b"cloak:auth";
const RECOVERY_KEY_AD: &[u8] = b"cloak:rk";
const KDF_OUTPUT_LEN: usize = 32;

// Crockford base32 (no I, L, O, U) — unambiguous for humans transcribing keys.
const CROCKFORD: &[u8; 32] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/// Argon2id params tuned for desktop (moderate cost; adjustable later).
fn argon2() -> CryptoResult<Argon2<'static>> {
  let params = Params::new(19_456, 2, 1, Some(KDF_OUTPUT_LEN))
    .map_err(|e| CryptoError::Argon2(e.to_string()))?;
  Ok(Argon2::new(Algorithm::Argon2id, Version::V0x13, params))
}

fn derive(password: &str, salt_b64: &str, associated_data: &[u8]) -> CryptoResult<Zeroizing<[u8; 32]>> {
  let salt = B64.decode(salt_b64).map_err(|e| CryptoError::InvalidInput(e.to_string()))?;
  if salt.len() < 16 {
    return Err(CryptoError::InvalidInput(
      "crypto_salt must be at least 16 bytes".into(),
    ));
  }

  let mut out = Zeroizing::new([0u8; 32]);
  let argon2 = argon2()?;
  argon2
    .hash_password_into(password.as_bytes(), &salt, &mut *out)
    .map_err(|e| CryptoError::Argon2(e.to_string()))?;

  // Domain separation via associated-data mixing (plan: ad="cloak:mk" / "cloak:auth").
  for (byte, ad_byte) in out.iter_mut().zip(associated_data.iter().cycle()) {
    *byte ^= ad_byte;
  }

  Ok(out)
}

pub fn derive_master_key(password: &str, crypto_salt_b64: &str) -> CryptoResult<Zeroizing<[u8; 32]>> {
  derive(password, crypto_salt_b64, MASTER_KEY_AD)
}

pub fn derive_auth_hash(password: &str, crypto_salt_b64: &str) -> CryptoResult<Zeroizing<[u8; 32]>> {
  derive(password, crypto_salt_b64, AUTH_HASH_AD)
}

pub fn auth_hash_b64(password: &str, crypto_salt_b64: &str) -> CryptoResult<String> {
  let hash = derive_auth_hash(password, crypto_salt_b64)?;
  Ok(B64.encode(*hash))
}

pub fn generate_crypto_salt_b64() -> String {
  let mut salt = [0u8; 16];
  rand::RngCore::fill_bytes(&mut rand::thread_rng(), &mut salt);
  B64.encode(salt)
}

/// Derive the recovery wrapping key from the (normalized) recovery key. Uses a
/// distinct associated-data domain so it can never collide with the MasterKey.
pub fn derive_recovery_wrapping_key(
  recovery_key: &str,
  crypto_salt_b64: &str,
) -> CryptoResult<Zeroizing<[u8; 32]>> {
  let normalized = normalize_recovery_key(recovery_key);
  if normalized.is_empty() {
    return Err(CryptoError::InvalidInput("recovery key is empty".into()));
  }
  derive(&normalized, crypto_salt_b64, RECOVERY_KEY_AD)
}

/// Canonicalize user-typed recovery keys: uppercase, strip separators, and map
/// visually ambiguous characters onto the Crockford alphabet.
pub fn normalize_recovery_key(input: &str) -> String {
  input
    .chars()
    .filter_map(|c| match c.to_ascii_uppercase() {
      'O' => Some('0'),
      'I' | 'L' => Some('1'),
      'U' => Some('V'),
      u @ ('0'..='9' | 'A'..='Z') => Some(u),
      _ => None,
    })
    .collect()
}

/// Generate a 160-bit recovery key formatted as 8 groups of 4 Crockford chars.
pub fn generate_recovery_key() -> String {
  let mut bytes = [0u8; 20];
  rand::thread_rng().fill_bytes(&mut bytes);

  let mut chars = String::with_capacity(32);
  let mut buffer: u32 = 0;
  let mut bits: u32 = 0;
  for &b in bytes.iter() {
    buffer = (buffer << 8) | b as u32;
    bits += 8;
    while bits >= 5 {
      bits -= 5;
      let idx = ((buffer >> bits) & 0x1f) as usize;
      chars.push(CROCKFORD[idx] as char);
    }
  }
  if bits > 0 {
    let idx = ((buffer << (5 - bits)) & 0x1f) as usize;
    chars.push(CROCKFORD[idx] as char);
  }

  chars
    .as_bytes()
    .chunks(4)
    .map(|c| std::str::from_utf8(c).unwrap_or(""))
    .collect::<Vec<_>>()
    .join("-")
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn master_key_and_auth_hash_differ() {
    let salt = generate_crypto_salt_b64();
    let mk = derive_master_key("test-password", &salt).unwrap();
    let ah = derive_auth_hash("test-password", &salt).unwrap();
    assert_ne!(*mk, *ah);
  }

  #[test]
  fn derivation_is_deterministic() {
    let salt = generate_crypto_salt_b64();
    let a = derive_master_key("pw", &salt).unwrap();
    let b = derive_master_key("pw", &salt).unwrap();
    assert_eq!(*a, *b);
  }

  #[test]
  fn recovery_key_format_and_normalization() {
    let rk = generate_recovery_key();
    // 8 groups of 4 chars joined by hyphens.
    assert_eq!(rk.split('-').count(), 8);
    // Normalizing the display form (with hyphens) must match a lowercase/spaced variant.
    let n1 = normalize_recovery_key(&rk);
    let n2 = normalize_recovery_key(&rk.to_lowercase().replace('-', " "));
    assert_eq!(n1, n2);
    assert_eq!(n1.len(), 32);
  }

  #[test]
  fn recovery_wrapping_key_differs_from_master() {
    let salt = generate_crypto_salt_b64();
    let mk = derive_master_key("pw", &salt).unwrap();
    let rk = derive_recovery_wrapping_key("ABCD-EFGH", &salt).unwrap();
    assert_ne!(*mk, *rk);
  }
}
