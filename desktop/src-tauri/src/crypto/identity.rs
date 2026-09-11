/// Per-user identity keypair (X25519). Used to wrap an Org DEK for a member
/// without the sender needing a keypair of their own — the anonymous sealed-box
/// construction from libsodium.

use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use crypto_box::{PublicKey, SecretKey};
use sha2::{Digest, Sha256};
use zeroize::Zeroizing;

use super::error::{CryptoError, CryptoResult};

const KEY_LEN: usize = 32;

pub struct IdentityKeypair {
  pub public_key_b64: String,
  pub secret_key: Zeroizing<[u8; KEY_LEN]>,
}

pub fn generate_identity_keypair() -> IdentityKeypair {
  let secret = SecretKey::generate(&mut rand::thread_rng());
  let public = secret.public_key();
  IdentityKeypair {
    // `as_bytes()` borrows the public key's internal bytes; Base64 encoding
    // only needs this temporary borrowed data.
    public_key_b64: B64.encode(public.as_bytes()),
    // The secret key needs owned storage, wrapped in `Zeroizing` so it is
    // cleared from memory when dropped.
    secret_key: Zeroizing::new(secret.to_bytes()),
  }
}

fn decode_key(value: &str, label: &str) -> CryptoResult<[u8; KEY_LEN]> {
  let bytes = B64.decode(value)?;
  if bytes.len() != KEY_LEN {
    return Err(CryptoError::InvalidInput(format!(
      "{label} must be {KEY_LEN} bytes"
    )));
  }
  let mut out = [0u8; KEY_LEN];
  out.copy_from_slice(&bytes);
  Ok(out)
}

/// Encrypt to a recipient's public key. The sender is anonymous and cannot read
/// the result back — only the holder of the matching secret key can open it.
pub fn seal_to_public_key(recipient_public_key_b64: &str, plaintext: &[u8]) -> CryptoResult<String> {
  let public = PublicKey::from_bytes(decode_key(recipient_public_key_b64, "public key")?);
  let sealed = public
    .seal(&mut rand::thread_rng(), plaintext)
    .map_err(|e| CryptoError::Aead(e.to_string()))?;
  Ok(B64.encode(sealed))
}

pub fn open_sealed(secret_key: &[u8; KEY_LEN], sealed_b64: &str) -> CryptoResult<Zeroizing<Vec<u8>>> {
  let secret = SecretKey::from_bytes(*secret_key);
  let sealed = B64.decode(sealed_b64)?;
  let opened = secret
    .unseal(&sealed)
    .map_err(|e| CryptoError::Aead(e.to_string()))?;
  Ok(Zeroizing::new(opened))
}

pub fn public_key_b64(secret_key: &[u8; KEY_LEN]) -> String {
  B64.encode(SecretKey::from_bytes(*secret_key).public_key().as_bytes())
}

/// Digest of a public key for out-of-band comparison. An admin sealing an Org
/// DEK to a new member has only the server's word for which key is theirs;
/// both sides reading this aloud is what catches a substituted key.
///
/// 160 bits, hex in groups of four. The adversary this defends against already
/// controls the server, so they can grind keypairs offline looking for a
/// colliding fingerprint — the width has to make that search hopeless, not
/// merely expensive. Hex rather than the Crockford base32 used for recovery
/// keys: it keeps the two strings visually distinct, and 0-9A-F is already
/// unambiguous when spoken.
pub fn fingerprint(public_key_b64: &str) -> CryptoResult<String> {
  let key = decode_key(public_key_b64, "public key")?;
  let digest = Sha256::digest(key);
  let hex: String = digest[..20].iter().map(|b| format!("{b:02X}")).collect();
  Ok(
    hex
      .as_bytes()
      .chunks(4)
      .filter_map(|c| std::str::from_utf8(c).ok())
      .collect::<Vec<_>>()
      .join("-"),
  )
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn seal_open_round_trip() {
    let kp = generate_identity_keypair();
    let sealed = seal_to_public_key(&kp.public_key_b64, b"org dek bytes").unwrap();
    let opened = open_sealed(&kp.secret_key, &sealed).unwrap();
    assert_eq!(&*opened, b"org dek bytes");
  }

  #[test]
  fn wrong_key_cannot_open() {
    let kp = generate_identity_keypair();
    let other = generate_identity_keypair();
    let sealed = seal_to_public_key(&kp.public_key_b64, b"secret").unwrap();
    assert!(open_sealed(&other.secret_key, &sealed).is_err());
  }

  #[test]
  fn tampered_ciphertext_is_rejected() {
    let kp = generate_identity_keypair();
    let sealed = seal_to_public_key(&kp.public_key_b64, b"secret").unwrap();
    let mut raw = B64.decode(&sealed).unwrap();
    let last = raw.len() - 1;
    raw[last] ^= 0x01;
    assert!(open_sealed(&kp.secret_key, &B64.encode(raw)).is_err());
  }

  #[test]
  fn public_key_derives_from_secret() {
    let kp = generate_identity_keypair();
    assert_eq!(public_key_b64(&kp.secret_key), kp.public_key_b64);
  }

  /// The whole sharing chain, as the app performs it: an owner mints an Org DEK
  /// and seals it to itself, then grants a second member by sealing the same DEK
  /// to their public key. A third party must get nothing.
  #[test]
  fn org_dek_sharing_round_trip() {
    use crate::crypto::dek::generate_dek;

    let owner = generate_identity_keypair();
    let member = generate_identity_keypair();
    let outsider = generate_identity_keypair();

    let org_dek = generate_dek();
    let for_owner = seal_to_public_key(&owner.public_key_b64, &*org_dek).unwrap();
    let for_member = seal_to_public_key(&member.public_key_b64, &*org_dek).unwrap();

    assert_eq!(&*open_sealed(&owner.secret_key, &for_owner).unwrap(), &*org_dek);
    assert_eq!(&*open_sealed(&member.secret_key, &for_member).unwrap(), &*org_dek);

    // Each wrap is addressed to exactly one member.
    assert!(open_sealed(&outsider.secret_key, &for_member).is_err());
    assert!(open_sealed(&member.secret_key, &for_owner).is_err());
  }

  /// Break-glass: the org recovery key alone reopens the Org DEK, without any
  /// member device or identity key.
  #[test]
  fn org_recovery_envelope_round_trip() {
    use crate::crypto::dek::{generate_dek, unwrap_dek, wrap_dek};
    use crate::crypto::kdf::{derive_recovery_wrapping_key, generate_crypto_salt_b64, generate_recovery_key};

    let org_dek = generate_dek();
    let recovery_key = generate_recovery_key();
    let salt = generate_crypto_salt_b64();

    let wrapping_key = derive_recovery_wrapping_key(&recovery_key, &salt).unwrap();
    let envelope = wrap_dek(&wrapping_key, &org_dek).unwrap();

    // The user retypes it lowercase with spaces; normalization must still match.
    let retyped = recovery_key.to_lowercase().replace('-', " ");
    let reopened = derive_recovery_wrapping_key(&retyped, &salt).unwrap();
    assert_eq!(*unwrap_dek(&reopened, &envelope).unwrap(), *org_dek);

    let wrong = derive_recovery_wrapping_key(&generate_recovery_key(), &salt).unwrap();
    assert!(unwrap_dek(&wrong, &envelope).is_err());
  }

  #[test]
  fn fingerprint_is_stable_and_distinct() {
    let kp = generate_identity_keypair();
    let other = generate_identity_keypair();
    assert_eq!(fingerprint(&kp.public_key_b64).unwrap(), fingerprint(&kp.public_key_b64).unwrap());
    assert_ne!(fingerprint(&kp.public_key_b64).unwrap(), fingerprint(&other.public_key_b64).unwrap());
  }

  #[test]
  fn fingerprint_carries_160_bits() {
    let fp = fingerprint(&generate_identity_keypair().public_key_b64).unwrap();
    let groups: Vec<&str> = fp.split('-').collect();
    assert_eq!(groups.len(), 10);
    assert!(groups.iter().all(|g| g.len() == 4));
    // 40 hex characters = 20 bytes = 160 bits.
    assert_eq!(fp.replace('-', "").len(), 40);
  }
}
