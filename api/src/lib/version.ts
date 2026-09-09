/**
 * Release identity of this build, reported to the desktop client so it can
 * refuse to talk to a server it does not understand.
 *
 * Bump `SERVER_VERSION` with every release. Bump `API_CONTRACT` only when a
 * change breaks existing clients — the desktop app compares that integer, not
 * the release string, so patch releases never force anyone to upgrade.
 * `MIN_CLIENT_VERSION` is the oldest desktop build this server still serves.
 */
export const SERVER_VERSION = '0.2.0';
export const API_CONTRACT = 1;
export const MIN_CLIENT_VERSION = '0.2.0';
