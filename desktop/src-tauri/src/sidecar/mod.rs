//! Runs the Cloak API as a child process tied to the app's lifetime.
//!
//! The backend is NOT bundled — it is the `dist/` build of the `api` workspace
//! package, located via `CLOAK_API_DIR`. Keeping it outside the bundle means a
//! backend change only needs `pnpm build:api`, not a new AppImage.
//!
//! Debug builds skip all of this; `pnpm dev:api` owns the backend there.

// Nothing calls start() in debug (see lib.rs), so its whole helper chain is
// legitimately unused there. Scoped to debug so real dead code still warns in release.
#![cfg_attr(debug_assertions, allow(dead_code))]

use std::io::{BufRead, BufReader};
use std::net::{Ipv4Addr, SocketAddrV4, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use parking_lot::Mutex;

/// Fixed, deliberately uncommon port so the app never collides with a dev
/// server on 3000/4000/5173.
pub const API_PORT: u16 = 47821;

const READY_TIMEOUT: Duration = Duration::from_secs(20);

/// Handle to the spawned backend, stored in Tauri's state so the exit hook can
/// reach it.
#[derive(Default)]
pub struct ApiProcess(Mutex<Option<Child>>);

/// Resolves the `api` package directory: runtime env wins, then the value baked
/// in at compile time by `pnpm ship`.
fn api_dir() -> Option<PathBuf> {
    if let Ok(dir) = std::env::var("CLOAK_API_DIR") {
        if !dir.is_empty() {
            return Some(PathBuf::from(dir));
        }
    }
    option_env!("CLOAK_API_DIR")
        .filter(|d| !d.is_empty())
        .map(PathBuf::from)
}

/// Drains a child pipe into the app log. These threads are mandatory: an
/// unread pipe fills its buffer and blocks the backend on its next write.
fn forward<R: std::io::Read + Send + 'static>(stream: R, stderr: bool) {
    thread::spawn(move || {
        for line in BufReader::new(stream).lines().map_while(Result::ok) {
            if stderr {
                log::warn!("[api] {line}");
            } else {
                log::info!("[api] {line}");
            }
        }
    });
}

/// Blocks until the backend accepts connections. `server.ts` only listens after
/// `connectDb()` resolves, so an open port means Mongo is up too.
fn wait_until_ready(child: &mut Child) -> Result<(), String> {
    let addr = SocketAddrV4::new(Ipv4Addr::LOCALHOST, API_PORT);
    let deadline = Instant::now() + READY_TIMEOUT;

    while Instant::now() < deadline {
        // Surface a crashed backend immediately rather than waiting out the timeout.
        match child.try_wait() {
            Ok(Some(status)) => return Err(format!("backend exited during startup ({status})")),
            Ok(None) => {}
            Err(e) => return Err(format!("could not poll backend: {e}")),
        }
        if TcpStream::connect_timeout(&addr.into(), Duration::from_millis(300)).is_ok() {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(150));
    }
    Err(format!("backend did not listen on :{API_PORT} within {READY_TIMEOUT:?}"))
}

/// Spawns the backend and blocks until it is serving.
pub fn start(state: &ApiProcess) -> Result<(), String> {
    let dir = api_dir().ok_or_else(|| {
        "CLOAK_API_DIR is not set — build with `pnpm ship` so the app knows where the backend lives"
            .to_string()
    })?;
    let entry = dir.join("dist/server.js");
    if !entry.exists() {
        return Err(format!("backend not built: {} is missing — run `pnpm build:api`", entry.display()));
    }

    let mut child = Command::new("node")
        .arg(&entry)
        // cwd drives dotenv's .env lookup, so the backend reads `api/.env` unchanged.
        .current_dir(&dir)
        .env("PORT", API_PORT.to_string())
        .env("NODE_ENV", "production")
        // Opts the backend into the stdin orphan guard (see api/src/server.ts).
        .env("CLOAK_SIDECAR", "1")
        // Held open by this process; its EOF is what kills an orphaned backend.
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("could not spawn node: {e}"))?;

    if let Some(out) = child.stdout.take() {
        forward(out, false);
    }
    if let Some(err) = child.stderr.take() {
        forward(err, true);
    }

    let ready = wait_until_ready(&mut child);
    if ready.is_err() {
        let _ = child.kill();
        let _ = child.wait();
        return ready;
    }

    log::info!("backend ready on 127.0.0.1:{API_PORT}");
    *state.0.lock() = Some(child);
    Ok(())
}

/// Kills the backend and reaps it. Safe to call more than once.
pub fn stop(state: &ApiProcess) {
    if let Some(mut child) = state.0.lock().take() {
        log::info!("stopping backend");
        let _ = child.kill();
        let _ = child.wait();
    }
}
