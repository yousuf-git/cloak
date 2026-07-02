use keyring::Entry;
use serde::{Deserialize, Serialize};

const SERVICE: &str = "app.cloak.desktop";
const ACCOUNT: &str = "remember-me";
const THIRTY_DAYS_MS: u64 = 30 * 24 * 60 * 60 * 1000;

#[derive(Serialize, Deserialize)]
struct RememberBlob {
  dek_b64: String,
  refresh_token: String,
  email: String,
  stored_at_ms: u64,
}

fn now_ms() -> u64 {
  use std::time::{SystemTime, UNIX_EPOCH};
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_millis() as u64)
    .unwrap_or(0)
}

fn entry() -> Result<Entry, String> {
  Entry::new(SERVICE, ACCOUNT).map_err(|e| e.to_string())
}

/// Persist the Remember-Me blob (DEK + refresh token) in OS secure storage.
pub fn save(dek_b64: &str, refresh_token: &str, email: &str) -> Result<(), String> {
  let blob = RememberBlob {
    dek_b64: dek_b64.to_string(),
    refresh_token: refresh_token.to_string(),
    email: email.to_string(),
    stored_at_ms: now_ms(),
  };
  let json = serde_json::to_string(&blob).map_err(|e| e.to_string())?;
  entry()?.set_password(&json).map_err(|e| e.to_string())
}

/// Check whether a valid (<=30d) Remember-Me entry exists, without loading the
/// DEK into the session. Purges expired/malformed entries as a side effect.
pub fn is_active() -> Result<bool, String> {
  let e = entry()?;
  let json = match e.get_password() {
    Ok(v) => v,
    Err(keyring::Error::NoEntry) => return Ok(false),
    Err(err) => return Err(err.to_string()),
  };
  let blob: RememberBlob = match serde_json::from_str(&json) {
    Ok(b) => b,
    Err(_) => {
      let _ = clear();
      return Ok(false);
    }
  };
  if now_ms().saturating_sub(blob.stored_at_ms) > THIRTY_DAYS_MS {
    let _ = clear();
    return Ok(false);
  }
  Ok(true)
}

pub fn clear() -> Result<(), String> {
  match entry()?.delete_credential() {
    Ok(()) => Ok(()),
    Err(keyring::Error::NoEntry) => Ok(()),
    Err(e) => Err(e.to_string()),
  }
}

pub struct RestoredSession {
  pub dek_b64: String,
  pub refresh_token: String,
  pub email: String,
}

/// Read the Remember-Me blob if present and within the 30-day window.
/// Purges the entry when expired or malformed.
pub fn restore() -> Result<Option<RestoredSession>, String> {
  let e = entry()?;
  let json = match e.get_password() {
    Ok(v) => v,
    Err(keyring::Error::NoEntry) => return Ok(None),
    Err(err) => return Err(err.to_string()),
  };

  let blob: RememberBlob = match serde_json::from_str(&json) {
    Ok(b) => b,
    Err(_) => {
      let _ = clear();
      return Ok(None);
    }
  };

  if now_ms().saturating_sub(blob.stored_at_ms) > THIRTY_DAYS_MS {
    let _ = clear();
    return Ok(None);
  }

  Ok(Some(RestoredSession {
    dek_b64: blob.dek_b64,
    refresh_token: blob.refresh_token,
    email: blob.email,
  }))
}
