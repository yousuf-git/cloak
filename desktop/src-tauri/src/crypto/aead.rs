/// AEAD: Authenticated Encryption with Associated Data

use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use chacha20poly1305::{
  aead::{Aead, KeyInit},
  XChaCha20Poly1305, XNonce,
};
use rand::RngCore;
use zeroize::Zeroizing;

use super::error::{CryptoError, CryptoResult};

const NONCE_LEN: usize = 24;

/// Seal plaintext with XChaCha20-Poly1305. Output: base64(nonce ‖ ciphertext ‖ tag).
pub fn seal(key: &[u8; 32], plaintext: &[u8]) -> CryptoResult<String> {
  let cipher = XChaCha20Poly1305::new(key.into());
  let mut nonce_bytes = [0u8; NONCE_LEN];
  rand::thread_rng().fill_bytes(&mut nonce_bytes);
  let nonce = XNonce::from_slice(&nonce_bytes);

  let ciphertext = cipher
    .encrypt(nonce, plaintext)
    .map_err(|e| CryptoError::Aead(e.to_string()))?;

  let mut out = Vec::with_capacity(NONCE_LEN + ciphertext.len());
  out.extend_from_slice(&nonce_bytes);
  out.extend_from_slice(&ciphertext);
  Ok(B64.encode(out))
}

/// Open a sealed blob produced by [`seal`].
pub fn open(key: &[u8; 32], sealed_b64: &str) -> CryptoResult<Zeroizing<Vec<u8>>> {
  let bytes = B64.decode(sealed_b64)?;
  if bytes.len() <= NONCE_LEN {
    return Err(CryptoError::InvalidInput("ciphertext too short".into()));
  }

  let (nonce_bytes, ciphertext) = bytes.split_at(NONCE_LEN);
  let cipher = XChaCha20Poly1305::new(key.into());
  let nonce = XNonce::from_slice(nonce_bytes);

  let plaintext = cipher
    .decrypt(nonce, ciphertext)
    .map_err(|e| CryptoError::Aead(e.to_string()))?;

  Ok(Zeroizing::new(plaintext))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn round_trip() {
    let key = [7u8; 32];
    let sealed = seal(&key, b"hello cloak").unwrap();
    let opened = open(&key, &sealed).unwrap();
    assert_eq!(&*opened, b"hello cloak");
  }
}
