import tauriConfig from '../../src-tauri/tauri.conf.json';
import compat from '../compat.json';

/** This build's version, read from the file the installers are stamped from. */
export const APP_VERSION: string = tauriConfig.version;

/**
 * The oldest server this build works with. The release workflow copies it into
 * the update feed, so an app that is about to update can tell whether its
 * server is new enough for the version it would become.
 */
export const MIN_SERVER_VERSION: string = compat.min_server_version;

/**
 * Orders two `x.y.z` versions numerically. A leading `v` and anything after a
 * hyphen are ignored: releases here are never pre-releases, and treating one as
 * its final version errs toward offering it rather than hiding it.
 */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) =>
    v.replace(/^v/, '').split('-')[0]!.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const [pa, pb] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}

export function isOlder(version: string, than: string): boolean {
  return compareVersions(version, than) < 0;
}
