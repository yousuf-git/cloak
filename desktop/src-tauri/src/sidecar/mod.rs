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
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

/// Fixed, deliberately uncommon port so the app never collides with a dev
/// server on 3000/4000/5173.
pub const API_PORT: u16 = 47821;

/// Longest the backend may go without a word — no output, no open port —
/// before it counts as hung. Its own database retries report in well inside
/// this (each attempt is capped at 12s), so a slow start that is still making
/// progress is never cut off.
const STALL_TIMEOUT: Duration = Duration::from_secs(30);

/// Restarts of the process itself, for failures the backend could not explain:
/// a crash, a hang, `node` missing. A failure it did explain is final — by then
/// the backend has already retried whatever was worth retrying, its database
/// connection included, and doing it again here would only multiply the wait.
const MAX_ATTEMPTS: u32 = 3;
const FIRST_BACKOFF: Duration = Duration::from_secs(2);
const MAX_BACKOFF: Duration = Duration::from_secs(30);

/// Marks a structured startup line on the backend's stderr. Must match
/// `reportStartup` in api/src/server.ts.
const STARTUP_PREFIX: &str = "CLOAK_STARTUP ";

/// Why a start failed, in terms the sign-in screen can act on.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct StartupError {
    /// The step that failed when the backend said so — `database` or
    /// `deployment`. None for failures seen only from outside.
    pub stage: Option<String>,
    pub message: String,
}

impl StartupError {
    fn unexplained(message: impl Into<String>) -> Self {
        Self {
            stage: None,
            message: message.into(),
        }
    }
}

/// The backend's own progress through its database connection retries.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct DatabaseRetry {
    pub attempt: u32,
    pub max_attempts: u32,
}

/// What the web layer shows while the backend is not serving yet.
#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum SidecarStatus {
    /// This build does not run its own backend.
    #[default]
    Disabled,
    Starting {
        attempt: u32,
        max_attempts: u32,
        /// The latest failure: the previous process attempt's, or the
        /// backend's last database attempt while it is retrying.
        last_error: Option<StartupError>,
        database: Option<DatabaseRetry>,
    },
    Ready,
    Failed {
        error: StartupError,
        log_dir: Option<String>,
    },
}

/// Handle to the spawned backend, stored in Tauri's state so the exit hook and
/// the startup thread can both reach it.
#[derive(Default)]
pub struct ApiProcess {
    child: Mutex<Option<Child>>,
    status: Mutex<SidecarStatus>,
    /// Set by `stop()`. A start still in flight when the app quits must not
    /// leave a backend behind that nothing will ever reap.
    shutting_down: AtomicBool,
}

impl ApiProcess {
    pub fn status(&self) -> SidecarStatus {
        self.status.lock().clone()
    }

    fn set_status(&self, status: SidecarStatus) {
        *self.status.lock() = status;
    }
}

/// Wait before the restart that follows the `failures`-th failed attempt:
/// 2s, 4s, 8s, 16s, capped at 30s.
fn backoff(failures: u32) -> Duration {
    let factor = 1u32 << failures.saturating_sub(1).min(16);
    FIRST_BACKOFF.saturating_mul(factor).min(MAX_BACKOFF)
}

#[derive(Debug, PartialEq, Deserialize)]
#[serde(tag = "event", rename_all = "snake_case")]
enum StartupEvent {
    Progress {
        stage: String,
        attempt: u32,
        max_attempts: u32,
        message: String,
    },
    Failure {
        stage: String,
        message: String,
    },
}

fn parse_startup_event(line: &str) -> Option<StartupEvent> {
    serde_json::from_str(line.strip_prefix(STARTUP_PREFIX)?).ok()
}

/// What one run of the backend has said about its startup, fed by its output.
struct Report {
    last_heard: Instant,
    database: Option<DatabaseRetry>,
    progress_error: Option<StartupError>,
    failure: Option<StartupError>,
}

impl Report {
    fn new() -> Self {
        Self {
            last_heard: Instant::now(),
            database: None,
            progress_error: None,
            failure: None,
        }
    }

    fn hear(&mut self, line: &str) {
        self.last_heard = Instant::now();
        match parse_startup_event(line) {
            Some(StartupEvent::Progress {
                stage,
                attempt,
                max_attempts,
                message,
            }) => {
                if stage == "database" {
                    self.database = Some(DatabaseRetry {
                        attempt,
                        max_attempts,
                    });
                }
                self.progress_error = Some(StartupError {
                    stage: Some(stage),
                    message,
                });
            }
            Some(StartupEvent::Failure { stage, message }) => {
                self.failure = Some(StartupError {
                    stage: Some(stage),
                    message,
                });
            }
            None => {}
        }
    }
}

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

/// Drains a child pipe into the app log, and into the startup report. These
/// threads are mandatory: an unread pipe fills its buffer and blocks the
/// backend on its next write.
fn forward<R: std::io::Read + Send + 'static>(
    stream: R,
    stderr: bool,
    report: Arc<Mutex<Report>>,
) -> JoinHandle<()> {
    thread::spawn(move || {
        for line in BufReader::new(stream).lines().map_while(Result::ok) {
            report.lock().hear(&line);
            if stderr {
                log::warn!("[api] {line}");
            } else {
                log::info!("[api] {line}");
            }
        }
    })
}

/// Blocks until the backend accepts connections. `server.ts` only listens after
/// `connectDb()` resolves, so an open port means Mongo is up too. Meanwhile the
/// backend's database retries are passed through to the status.
fn wait_until_ready(
    child: &mut Child,
    state: &ApiProcess,
    attempt: u32,
    previous_error: &Option<StartupError>,
    report: &Mutex<Report>,
) -> Result<(), StartupError> {
    let addr = SocketAddrV4::new(Ipv4Addr::LOCALHOST, API_PORT);
    let mut shown: Option<DatabaseRetry> = None;

    loop {
        if state.shutting_down.load(Ordering::SeqCst) {
            return Err(StartupError::unexplained("the app is closing"));
        }
        // Surface a crashed backend immediately rather than waiting out the timeout.
        match child.try_wait() {
            Ok(Some(status)) => {
                return Err(StartupError::unexplained(format!(
                    "backend exited during startup ({status})"
                )))
            }
            Ok(None) => {}
            Err(e) => return Err(StartupError::unexplained(format!("could not poll backend: {e}"))),
        }
        if TcpStream::connect_timeout(&addr.into(), Duration::from_millis(300)).is_ok() {
            return Ok(());
        }

        {
            let report = report.lock();
            if report.last_heard.elapsed() > STALL_TIMEOUT {
                return Err(StartupError::unexplained(format!(
                    "backend went quiet for {STALL_TIMEOUT:?} without starting"
                )));
            }
            if report.database != shown {
                shown = report.database.clone();
                state.set_status(SidecarStatus::Starting {
                    attempt,
                    max_attempts: MAX_ATTEMPTS,
                    last_error: report.progress_error.clone().or_else(|| previous_error.clone()),
                    database: shown.clone(),
                });
            }
        }
        thread::sleep(Duration::from_millis(150));
    }
}

/// Starts the backend on a background thread, restarting it with exponential
/// backoff when it fails in a way it could not explain.
///
/// Returns at once so the window can say "starting" instead of staying blank,
/// and so a slow or failed start no longer costs the whole session. A no-op
/// while a start is already running or the backend is up.
pub fn supervise(app: AppHandle) {
    {
        let state = app.state::<ApiProcess>();
        let mut status = state.status.lock();
        if matches!(*status, SidecarStatus::Starting { .. } | SidecarStatus::Ready) {
            return;
        }
        *status = SidecarStatus::Starting {
            attempt: 1,
            max_attempts: MAX_ATTEMPTS,
            last_error: None,
            database: None,
        };
    }

    thread::spawn(move || {
        let state = app.state::<ApiProcess>();
        let mut last_error: Option<StartupError> = None;

        for attempt in 1..=MAX_ATTEMPTS {
            if attempt > 1 {
                let delay = backoff(attempt - 1);
                log::warn!("restarting the backend in {delay:?}");
                thread::sleep(delay);
            }
            if state.shutting_down.load(Ordering::SeqCst) {
                return;
            }
            state.set_status(SidecarStatus::Starting {
                attempt,
                max_attempts: MAX_ATTEMPTS,
                last_error: last_error.clone(),
                database: None,
            });

            match start(&state, attempt, &last_error) {
                Ok(()) => return state.set_status(SidecarStatus::Ready),
                Err(e) => {
                    log::error!("local backend attempt {attempt}/{MAX_ATTEMPTS} failed: {}", e.message);
                    let explained = e.stage.is_some();
                    last_error = Some(e);
                    if explained {
                        break;
                    }
                }
            }
        }

        if state.shutting_down.load(Ordering::SeqCst) {
            return;
        }
        state.set_status(SidecarStatus::Failed {
            error: last_error.unwrap_or_else(|| StartupError::unexplained("backend did not start")),
            log_dir: app.path().app_log_dir().ok().map(|p| p.display().to_string()),
        });
    });
}

/// Spawns the backend and blocks until it is serving.
fn start(
    state: &ApiProcess,
    attempt: u32,
    previous_error: &Option<StartupError>,
) -> Result<(), StartupError> {
    let dir = api_dir().ok_or_else(|| {
        StartupError::unexplained(
            "CLOAK_API_DIR is not set — build with `pnpm ship` so the app knows where the backend lives",
        )
    })?;
    let entry = dir.join("dist/server.js");
    if !entry.exists() {
        return Err(StartupError::unexplained(format!(
            "backend not built: {} is missing — run `pnpm build:api`",
            entry.display()
        )));
    }

    let mut child = Command::new("node")
        .arg(&entry)
        // cwd drives dotenv's .env lookup, so the backend reads `api/.env` unchanged.
        .current_dir(&dir)
        .env("PORT", API_PORT.to_string())
        .env("NODE_ENV", "production")
        // Opts the backend into the stdin orphan guard and the startup reports
        // (see api/src/server.ts).
        .env("CLOAK_SIDECAR", "1")
        // Held open by this process; its EOF is what kills an orphaned backend.
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| StartupError::unexplained(format!("could not spawn node: {e}")))?;

    let report = Arc::new(Mutex::new(Report::new()));
    if let Some(out) = child.stdout.take() {
        forward(out, false, report.clone());
    }
    let stderr_reader = child.stderr.take().map(|err| forward(err, true, report.clone()));

    if let Err(seen) = wait_until_ready(&mut child, state, attempt, previous_error, &report) {
        let _ = child.kill();
        let _ = child.wait();
        // The backend's own account of the failure is its last stderr line, and
        // may still be in the pipe when the exit is noticed. The pipe closes
        // with the process, so this join is short.
        if let Some(reader) = stderr_reader {
            let _ = reader.join();
        }
        return Err(report.lock().failure.clone().unwrap_or(seen));
    }

    // Checked under the lock `stop()` takes after raising the flag, so either
    // this sees the flag or `stop()` sees the child — never neither.
    let mut slot = state.child.lock();
    if state.shutting_down.load(Ordering::SeqCst) {
        let _ = child.kill();
        let _ = child.wait();
        return Err(StartupError::unexplained("the app is closing"));
    }
    log::info!("backend ready on 127.0.0.1:{API_PORT}");
    *slot = Some(child);
    Ok(())
}

/// Kills the backend and reaps it. Safe to call more than once.
pub fn stop(state: &ApiProcess) {
    state.shutting_down.store(true, Ordering::SeqCst);
    if let Some(mut child) = state.child.lock().take() {
        log::info!("stopping backend");
        let _ = child.kill();
        let _ = child.wait();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backoff_doubles_then_caps() {
        let secs: Vec<u64> = (1..=6).map(|n| backoff(n).as_secs()).collect();
        assert_eq!(secs, vec![2, 4, 8, 16, 30, 30]);
    }

    #[test]
    fn restarts_stay_bounded() {
        let waiting: Duration = (1..MAX_ATTEMPTS).map(backoff).sum();
        assert_eq!(waiting, Duration::from_secs(6));
    }

    #[test]
    fn parses_the_backend_startup_lines() {
        assert_eq!(
            parse_startup_event(
                r#"CLOAK_STARTUP {"event":"progress","stage":"database","attempt":2,"max_attempts":5,"message":"querySrv ETIMEOUT"}"#
            ),
            Some(StartupEvent::Progress {
                stage: "database".into(),
                attempt: 2,
                max_attempts: 5,
                message: "querySrv ETIMEOUT".into(),
            })
        );
        assert_eq!(
            parse_startup_event(r#"CLOAK_STARTUP {"event":"failure","stage":"database","message":"down"}"#),
            Some(StartupEvent::Failure {
                stage: "database".into(),
                message: "down".into(),
            })
        );
        assert_eq!(parse_startup_event(r#"{"level":30,"msg":"MongoDB connected"}"#), None);
        assert_eq!(parse_startup_event("CLOAK_STARTUP not json"), None);
    }

    #[test]
    fn report_tracks_database_retries_and_the_final_failure() {
        let mut report = Report::new();
        report.hear(r#"{"level":30,"msg":"injected env"}"#);
        assert_eq!(report.database, None);

        report.hear(
            r#"CLOAK_STARTUP {"event":"progress","stage":"database","attempt":3,"max_attempts":5,"message":"timed out"}"#,
        );
        assert_eq!(
            report.database,
            Some(DatabaseRetry {
                attempt: 3,
                max_attempts: 5
            })
        );
        assert_eq!(report.progress_error.as_ref().unwrap().message, "timed out");

        report.hear(r#"CLOAK_STARTUP {"event":"failure","stage":"database","message":"gave up"}"#);
        assert_eq!(
            report.failure,
            Some(StartupError {
                stage: Some("database".into()),
                message: "gave up".into()
            })
        );
    }

    #[test]
    fn status_is_tagged_for_the_web_layer() {
        let starting = serde_json::to_value(SidecarStatus::Starting {
            attempt: 1,
            max_attempts: MAX_ATTEMPTS,
            last_error: Some(StartupError {
                stage: Some("database".into()),
                message: "boom".into(),
            }),
            database: Some(DatabaseRetry {
                attempt: 2,
                max_attempts: 5,
            }),
        })
        .unwrap();
        assert_eq!(starting["state"], "starting");
        assert_eq!(starting["last_error"]["stage"], "database");
        assert_eq!(starting["database"]["attempt"], 2);

        let ready = serde_json::to_value(SidecarStatus::Ready).unwrap();
        assert_eq!(ready["state"], "ready");
    }
}
