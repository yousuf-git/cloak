//! Which backend this installation talks to.
//!
//! Cloak is self-hosted: the same installer points at any team's server, so the
//! address cannot be baked in at build time. It lives in a small JSON file in
//! the app config directory, written before anyone signs in and read on every
//! launch — which rules out `localStorage`, since the web layer has no origin
//! until a server is chosen.
//!
//! Nothing secret is stored here. Tokens stay in memory, the vault key stays in
//! the OS keychain, and this file holds only addresses and display names.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use crate::sidecar::{self, ApiProcess, SidecarStatus};

/// A backend this installation knows about. `id` is stable across renames so
/// the active pointer never dangles.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerProfile {
  pub id: String,
  /// Normalized origin plus API prefix, e.g. `https://vault.acme.com/api/v1`.
  pub url: String,
  /// As reported by the server, so the switcher shows "Acme Vault", not a host.
  pub name: String,
  /// Last email used here. Pre-fills the sign-in form; never a credential.
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub last_email: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ServerConfig {
  #[serde(default)]
  pub servers: Vec<ServerProfile>,
  #[serde(default)]
  pub active_id: Option<String>,
}

/// What the web layer receives: the stored file plus a fact about this build,
/// which is kept out of the file because it is recomputed on every launch.
#[derive(Debug, Serialize)]
pub struct ServerList {
  #[serde(flatten)]
  config: ServerConfig,
  /// True when this build can run its own backend (see `local_available`).
  local_available: bool,
}

impl From<ServerConfig> for ServerList {
  fn from(config: ServerConfig) -> Self {
    Self {
      config,
      local_available: local_available(),
    }
  }
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
  let dir = app
    .path()
    .app_config_dir()
    .map_err(|e| format!("no config directory: {e}"))?;
  fs::create_dir_all(&dir).map_err(|e| format!("could not create {}: {e}", dir.display()))?;
  Ok(dir.join("servers.json"))
}

/// Whether this binary can spawn its own backend.
///
/// Decided at compile time: `pnpm ship` bakes `CLOAK_API_DIR` in, release builds
/// from CI do not. So the "Local" option exists only in a build that can
/// actually honour it, and an installed release never offers a dead path.
fn local_available() -> bool {
  option_env!("CLOAK_API_DIR").is_some_and(|d| !d.is_empty())
}

fn load(app: &AppHandle) -> Result<ServerConfig, String> {
  let path = config_path(app)?;
  match fs::read_to_string(&path) {
    Ok(raw) => Ok(serde_json::from_str::<ServerConfig>(&raw).unwrap_or_else(|e| {
      // A corrupt file must not brick the app: fall back to first-run and let
      // the user re-enter an address rather than refusing to start.
      log::warn!("servers.json is unreadable ({e}) — starting from scratch");
      ServerConfig::default()
    })),
    Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(ServerConfig::default()),
    Err(e) => Err(format!("could not read {}: {e}", path.display())),
  }
}

fn save(app: &AppHandle, config: &ServerConfig) -> Result<(), String> {
  let path = config_path(app)?;
  let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
  fs::write(&path, json).map_err(|e| format!("could not write {}: {e}", path.display()))
}

#[tauri::command]
pub fn servers_list(app: AppHandle) -> Result<ServerList, String> {
  load(&app).map(Into::into)
}

/// Add a server, or update the one already registered at the same URL.
///
/// The URL is the identity: adding the same address twice should adopt the
/// existing profile rather than stack up duplicates that all point at one place.
#[tauri::command]
pub fn servers_save(
  app: AppHandle,
  url: String,
  name: String,
  last_email: Option<String>,
) -> Result<ServerList, String> {
  let mut config = load(&app)?;
  let url = url.trim_end_matches('/').to_string();

  let id = match config.servers.iter_mut().find(|s| s.url == url) {
    Some(existing) => {
      existing.name = name;
      if last_email.is_some() {
        existing.last_email = last_email;
      }
      existing.id.clone()
    }
    None => {
      let id = uuid();
      config.servers.push(ServerProfile {
        id: id.clone(),
        url,
        name,
        last_email,
      });
      id
    }
  };

  config.active_id = Some(id);
  save(&app, &config)?;
  Ok(config.into())
}

#[tauri::command]
pub fn servers_activate(app: AppHandle, id: String) -> Result<ServerList, String> {
  let mut config = load(&app)?;
  if !config.servers.iter().any(|s| s.id == id) {
    return Err("no such server".into());
  }
  config.active_id = Some(id);
  save(&app, &config)?;
  Ok(config.into())
}

#[tauri::command]
pub fn servers_forget(app: AppHandle, id: String) -> Result<ServerList, String> {
  let mut config = load(&app)?;
  config.servers.retain(|s| s.id != id);
  if config.active_id.as_deref() == Some(id.as_str()) {
    config.active_id = config.servers.first().map(|s| s.id.clone());
  }
  save(&app, &config)?;
  Ok(config.into())
}

/// Where this build's own backend is in starting up. `disabled` in any build
/// that does not run one, which is every release from CI.
#[tauri::command]
pub fn sidecar_status(state: State<'_, ApiProcess>) -> SidecarStatus {
  state.status()
}

/// Start the backend again after its retries ran out. Does nothing in any other
/// state, so a double click cannot spawn a second one.
#[tauri::command]
pub fn sidecar_retry(app: AppHandle) -> SidecarStatus {
  if matches!(app.state::<ApiProcess>().status(), SidecarStatus::Failed { .. }) {
    sidecar::supervise(app.clone());
  }
  app.state::<ApiProcess>().status()
}

/// Random enough to key a local list. Not a security boundary — these ids never
/// leave the machine and address nothing but rows in this file.
fn uuid() -> String {
  use std::time::{SystemTime, UNIX_EPOCH};
  let nanos = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_nanos())
    .unwrap_or_default();
  format!("{nanos:x}{:x}", rand::random::<u32>())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn list_carries_local_available_but_the_file_does_not() {
    let config = ServerConfig {
      servers: vec![],
      active_id: Some("a".into()),
    };

    let file = serde_json::to_value(&config).unwrap();
    assert!(file.get("local_available").is_none());

    let wire = serde_json::to_value(ServerList::from(config)).unwrap();
    assert_eq!(wire["active_id"], "a");
    assert!(wire["servers"].is_array());
    assert_eq!(wire["local_available"], local_available());
  }
}
