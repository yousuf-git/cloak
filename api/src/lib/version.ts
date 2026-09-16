/**
 * Release identity of this build, reported to the desktop client so it can
 * refuse to talk to a server it does not understand.
 *
 * Bump `SERVER_VERSION` with every server release; it must match
 * `api/package.json` and the `server-v` tag, which the release workflow checks.
 * Bump `API_CONTRACT` only when a change breaks existing clients.
 * `MIN_CLIENT_VERSION` is the oldest desktop build this server still serves;
 * the app enforces it and offers to update itself when it is too old.
 */
export const SERVER_VERSION = '0.3.0';
export const API_CONTRACT = 1;
export const MIN_CLIENT_VERSION = '0.2.0';
