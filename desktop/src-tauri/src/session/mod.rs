use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use parking_lot::Mutex;
use zeroize::Zeroizing;

use crate::crypto::error::{CryptoError, CryptoResult};

/// In-memory holder for MasterKey + VaultDEK. Never persisted here — OS keychain in Phase 2.
#[derive(Default)]
pub struct CryptoSession {
  inner: Mutex<SessionState>,
}

#[derive(Default)]
struct SessionState {
  master_key: Option<Zeroizing<[u8; 32]>>,
  dek: Option<Zeroizing<[u8; 32]>>,
}

impl CryptoSession {
  pub fn set_master_key(&self, key: Zeroizing<[u8; 32]>) {
    let mut state = self.inner.lock();
    state.master_key = Some(key);
  }

  pub fn set_dek(&self, dek: Zeroizing<[u8; 32]>) {
    let mut state = self.inner.lock();
    state.dek = Some(dek);
  }

  pub fn with_dek<R>(&self, f: impl FnOnce(&[u8; 32]) -> CryptoResult<R>) -> CryptoResult<R> {
    let state = self.inner.lock();
    let dek = state.dek.as_ref().ok_or(CryptoError::SessionLocked)?;
    f(dek)
  }

  // Used by Remember-Me keychain provisioning in Phase 2.
  #[allow(dead_code)]
  pub fn with_master_key<R>(&self, f: impl FnOnce(&[u8; 32]) -> CryptoResult<R>) -> CryptoResult<R> {
    let state = self.inner.lock();
    let mk = state.master_key.as_ref().ok_or(CryptoError::SessionLocked)?;
    f(mk)
  }

  pub fn clear(&self) {
    let mut state = self.inner.lock();
    state.master_key = None;
    state.dek = None;
  }

  pub fn is_unlocked(&self) -> bool {
    let state = self.inner.lock();
    state.dek.is_some()
  }

  /// Export the DEK as base64 for Remember-Me keychain storage.
  /// Stays within Rust — never returned to the webview.
  pub fn export_dek_b64(&self) -> CryptoResult<String> {
    let state = self.inner.lock();
    let dek = state.dek.as_ref().ok_or(CryptoError::SessionLocked)?;
    Ok(B64.encode(**dek))
  }

  /// Load a DEK from base64 (Remember-Me restore path).
  pub fn load_dek_from_b64(&self, dek_b64: &str) -> CryptoResult<()> {
    let bytes = B64
      .decode(dek_b64)
      .map_err(|e| CryptoError::InvalidInput(e.to_string()))?;
    if bytes.len() != 32 {
      return Err(CryptoError::InvalidInput("DEK must be 32 bytes".into()));
    }
    let mut dek = Zeroizing::new([0u8; 32]);
    dek.copy_from_slice(&bytes);
    self.set_dek(dek);
    Ok(())
  }
}
