use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use rand::RngCore;
use zeroize::Zeroizing;

use super::aead::{open, seal};
use super::error::CryptoResult;

pub fn generate_dek() -> Zeroizing<[u8; 32]> {
  let mut dek = Zeroizing::new([0u8; 32]);
  rand::thread_rng().fill_bytes(&mut *dek);
  dek
}

pub fn wrap_dek(master_key: &[u8; 32], dek: &[u8; 32]) -> CryptoResult<String> {
  seal(master_key, dek)
}

pub fn unwrap_dek(master_key: &[u8; 32], wrapped_b64: &str) -> CryptoResult<Zeroizing<[u8; 32]>> {
  let bytes = open(master_key, wrapped_b64)?;
  if bytes.len() != 32 {
    return Err(super::error::CryptoError::InvalidInput(
      "wrapped DEK must be 32 bytes".into(),
    ));
  }
  let mut dek = Zeroizing::new([0u8; 32]);
  dek.copy_from_slice(&bytes);
  Ok(dek)
}

pub fn encrypt_field(dek: &[u8; 32], plaintext: &str) -> CryptoResult<String> {
  seal(dek, plaintext.as_bytes())
}

pub fn decrypt_field(dek: &[u8; 32], ciphertext_b64: &str) -> CryptoResult<String> {
  let bytes = open(dek, ciphertext_b64)?;
  Ok(String::from_utf8(bytes.to_vec())?)
}

// Used by Remember-Me provisioning in Phase 2.
#[allow(dead_code)]
pub fn dek_b64(dek: &[u8; 32]) -> String {
  B64.encode(dek)
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::crypto::kdf::{derive_master_key, generate_crypto_salt_b64};

  #[test]
  fn dek_wrap_unwrap_round_trip() {
    let salt = generate_crypto_salt_b64();
    let mk = derive_master_key("pw", &salt).unwrap();
    let dek = generate_dek();
    let wrapped = wrap_dek(&mk, &dek).unwrap();
    let unwrapped = unwrap_dek(&mk, &wrapped).unwrap();
    assert_eq!(*dek, *unwrapped);
  }
}
