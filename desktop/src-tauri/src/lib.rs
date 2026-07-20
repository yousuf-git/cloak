mod commands;
mod crypto;
mod keystore;
mod session;
mod sidecar;

use commands::{
  app_version, crypto_decrypt_env_value, crypto_decrypt_field, crypto_derive_auth_hash,
  crypto_encrypt_env_value, crypto_encrypt_field, crypto_env_count_variables, crypto_env_decrypt,
  crypto_env_encrypt_existing, crypto_env_encrypt_new, crypto_env_wrap_key,
  crypto_generate_env_keypair, crypto_prepare_signup, crypto_recovery_reset, crypto_reveal_all_env,
  crypto_session_clear, crypto_session_status, crypto_unlock_session, read_text_file,
  remember_clear, remember_enable, remember_status, remember_try_restore, write_text_file,
};
use session::CryptoSession;
use sidecar::ApiProcess;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .manage(CryptoSession::default())
    .manage(ApiProcess::default())
    .setup(|app| {
      // Registered in release too: the sidecar only runs there, so its logs
      // would otherwise go nowhere and a failed startup would be silent.
      app.handle().plugin(
        tauri_plugin_log::Builder::default()
          .level(log::LevelFilter::Info)
          .build(),
      )?;

      // Debug builds leave the backend to `pnpm dev:api` — spawning here would
      // fight it for the port and lose tsx's hot reload.
      #[cfg(not(debug_assertions))]
      {
        use tauri::Manager;
        sidecar::start(&app.state::<ApiProcess>())?;
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
      write_text_file,
      read_text_file,
    ])
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|app, event| {
      // Last event before the process goes away — reap the backend so closing
      // the window doesn't leave an orphan holding the port.
      if let tauri::RunEvent::Exit = event {
        use tauri::Manager;
        sidecar::stop(&app.state::<ApiProcess>());
      }
    });
}
