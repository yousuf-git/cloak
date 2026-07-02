use thiserror::Error;

#[derive(Debug, Error)]
pub enum CryptoError {
  #[error("invalid base64: {0}")]
  Base64(#[from] base64::DecodeError),

  #[error("invalid UTF-8")]
  Utf8(#[from] std::string::FromUtf8Error),

  #[error("argon2: {0}")]
  Argon2(String),

  #[error("aead: {0}")]
  Aead(String),

  #[error("dotenvx: {0}")]
  Dotenvx(String),

  #[error("invalid input: {0}")]
  InvalidInput(String),

  #[error("session not unlocked")]
  SessionLocked,
}

pub type CryptoResult<T> = Result<T, CryptoError>;
