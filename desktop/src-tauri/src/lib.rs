mod commands;
mod crypto;
mod keystore;
mod session;

use commands::{
  app_version, crypto_decrypt_env_value, crypto_decrypt_field, crypto_derive_auth_hash,
  crypto_encrypt_env_value, crypto_encrypt_field, crypto_env_count_variables, crypto_env_decrypt,
  crypto_env_encrypt_existing, crypto_env_encrypt_new, crypto_env_wrap_key,
  crypto_generate_env_keypair, crypto_prepare_signup, crypto_recovery_reset, crypto_reveal_all_env,
  crypto_session_clear, crypto_session_status, crypto_unlock_session, remember_clear,
  remember_enable, remember_status, remember_try_restore,
};
use session::CryptoSession;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(CryptoSession::default())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      app_version,
      crypto_prepare_signup,
      crypto_derive_auth_hash,
      crypto_recovery_reset,
      crypto_unlock_session,
      crypto_encrypt_field,
      crypto_decrypt_field,
      crypto_generate_env_keypair,
      crypto_encrypt_env_value,
      crypto_decrypt_env_value,
      crypto_reveal_all_env,
      crypto_env_encrypt_new,
      crypto_env_decrypt,
      crypto_env_encrypt_existing,
      crypto_env_wrap_key,
      crypto_env_count_variables,
      crypto_session_clear,
      crypto_session_status,
      remember_enable,
      remember_try_restore,
      remember_clear,
      remember_status,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
