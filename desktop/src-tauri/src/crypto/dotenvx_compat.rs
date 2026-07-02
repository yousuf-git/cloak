use dotenvx::crypto::ecies::{decrypt, encrypt};
use dotenvx::crypto::Keypair;
use serde::Serialize;

use super::error::{CryptoError, CryptoResult};

#[derive(Debug, Serialize)]
pub struct EnvKeypair {
  pub public_key_hex: String,
  pub private_key_hex: String,
}

pub fn generate_env_keypair() -> EnvKeypair {
  let kp = Keypair::generate();
  EnvKeypair {
    public_key_hex: kp.public_key(),
    private_key_hex: kp.private_key(),
  }
}

pub fn encrypt_env_value(plaintext: &str, public_key_hex: &str) -> CryptoResult<String> {
  encrypt(plaintext, public_key_hex).map_err(|e| CryptoError::Dotenvx(e.to_string()))
}

pub fn decrypt_env_value(encrypted: &str, private_key_hex: &str) -> CryptoResult<String> {
  decrypt(encrypted, private_key_hex).map_err(|e| CryptoError::Dotenvx(e.to_string()))
}

const PUBLIC_KEY_VAR: &str = "DOTENV_PUBLIC_KEY";

/// Encrypt a full plaintext .env document into dotenvx wire format: a
/// `DOTENV_PUBLIC_KEY` header plus every `KEY=value` value replaced with
/// `encrypted:...`. Comments and blank lines are preserved verbatim.
pub fn encrypt_env_file(plaintext_env: &str, public_key_hex: &str) -> CryptoResult<String> {
  let mut out = String::new();
  out.push_str("#/ dotenvx encrypted (Cloak) /\n");
  out.push_str(&format!("{PUBLIC_KEY_VAR}=\"{public_key_hex}\"\n"));

  for line in plaintext_env.lines() {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.starts_with('#') {
      out.push_str(line);
      out.push('\n');
      continue;
    }
    let Some((key, raw_value)) = trimmed.split_once('=') else {
      out.push_str(line);
      out.push('\n');
      continue;
    };
    let key = key.trim();
    if key == PUBLIC_KEY_VAR {
      continue; // never re-emit an existing header from the plaintext
    }
    let value = raw_value.trim().trim_matches('"');
    let encrypted = encrypt_env_value(value, public_key_hex)?;
    out.push_str(&format!("{key}=\"{encrypted}\"\n"));
  }

  Ok(out)
}

/// Decrypt a dotenvx document back to plaintext, dropping the public-key header.
pub fn decrypt_env_file(encrypted_env: &str, private_key_hex: &str) -> CryptoResult<String> {
  let mut out = String::new();

  for line in encrypted_env.lines() {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.starts_with('#') {
      out.push_str(line);
      out.push('\n');
      continue;
    }
    let Some((key, raw_value)) = trimmed.split_once('=') else {
      out.push_str(line);
      out.push('\n');
      continue;
    };
    let key = key.trim();
    if key == PUBLIC_KEY_VAR {
      continue;
    }
    let value = raw_value.trim().trim_matches('"');
    if let Some(enc) = value.strip_prefix("encrypted:") {
      let full = format!("encrypted:{enc}");
      let plaintext = decrypt_env_value(&full, private_key_hex)?;
      out.push_str(&format!("{key}={plaintext}\n"));
    } else {
      out.push_str(&format!("{key}={value}\n"));
    }
  }

  Ok(out)
}

/// Read the `DOTENV_PUBLIC_KEY` from a dotenvx document, if present.
pub fn extract_public_key(encrypted_env: &str) -> Option<String> {
  for line in encrypted_env.lines() {
    let trimmed = line.trim();
    if let Some((key, value)) = trimmed.split_once('=') {
      if key.trim() == PUBLIC_KEY_VAR {
        return Some(value.trim().trim_matches('"').to_string());
      }
    }
  }
  None
}

/// Count assignable variables (excludes comments, blanks, and the header).
pub fn count_variables(env_text: &str) -> usize {
  env_text
    .lines()
    .map(str::trim)
    .filter(|l| !l.is_empty() && !l.starts_with('#'))
    .filter_map(|l| l.split_once('='))
    .filter(|(k, _)| k.trim() != PUBLIC_KEY_VAR)
    .count()
}

/// Decrypt every `encrypted:` value in a dotenv text block (Reveal All).
pub fn reveal_all_env_values(env_text: &str, private_key_hex: &str) -> CryptoResult<Vec<(String, String)>> {
  let mut out = Vec::new();

  for line in env_text.lines() {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.starts_with('#') {
      continue;
    }
    let Some((key, raw_value)) = trimmed.split_once('=') else {
      continue;
    };
    let key = key.trim().trim_matches('"').to_string();
    let value = raw_value.trim().trim_matches('"');
    if let Some(enc) = value.strip_prefix("encrypted:") {
      let full = format!("encrypted:{enc}");
      let plaintext = decrypt_env_value(&full, private_key_hex)?;
      out.push((key, plaintext));
    }
  }

  Ok(out)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn dotenvx_round_trip() {
    let kp = generate_env_keypair();
    let enc = encrypt_env_value("super-secret", &kp.public_key_hex).unwrap();
    assert!(enc.starts_with("encrypted:"));
    let dec = decrypt_env_value(&enc, &kp.private_key_hex).unwrap();
    assert_eq!(dec, "super-secret");
  }

  #[test]
  fn env_file_round_trip_preserves_values_and_comments() {
    let kp = generate_env_keypair();
    let plain = "# app config\nDATABASE_URL=postgres://x\nAPI_KEY=sk-123\n\n# trailing\n";
    let encrypted = encrypt_env_file(plain, &kp.public_key_hex).unwrap();
    assert!(encrypted.contains("DOTENV_PUBLIC_KEY"));
    assert!(encrypted.contains("encrypted:"));
    assert_eq!(count_variables(&encrypted), 2);
    assert_eq!(extract_public_key(&encrypted).as_deref(), Some(kp.public_key_hex.as_str()));

    let decrypted = decrypt_env_file(&encrypted, &kp.private_key_hex).unwrap();
    assert!(decrypted.contains("DATABASE_URL=postgres://x"));
    assert!(decrypted.contains("API_KEY=sk-123"));
    assert!(decrypted.contains("# app config"));
    assert!(!decrypted.contains("DOTENV_PUBLIC_KEY"));
  }

  #[test]
  fn reveal_all_parses_env_lines() {
    let kp = generate_env_keypair();
    let enc = encrypt_env_value("db-pass", &kp.public_key_hex).unwrap();
    let env = format!("DATABASE_URL=\"postgres://x\"\nDB_PASS=\"{enc}\"\n");
    let revealed = reveal_all_env_values(&env, &kp.private_key_hex).unwrap();
    assert_eq!(revealed, vec![("DB_PASS".to_string(), "db-pass".to_string())]);
  }
}
