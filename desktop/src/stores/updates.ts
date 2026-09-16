import { create } from 'zustand';
import type { Update } from '@tauri-apps/plugin-updater';
import { fetchNewestServerRelease, type ServerRelease } from '@/lib/releases';
import { inTauri } from '@/lib/native-fs';
import { useServers } from '@/stores/server';

/** How often a running app looks again, when automatic checks are on. */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

const AUTO_CHECK_KEY = 'cloak.updates.auto';

/**
 * Whether this build can replace itself. Only an installed release can: the
 * browser preview has nothing to replace, a dev build is the source tree, and a
 * `pnpm ship` build runs a backend from this repository that a downloaded
 * release would not have.
 */
export type UpdateSupport = 'supported' | 'preview' | 'development' | 'source-build';

export function updateSupport(): UpdateSupport {
  if (!inTauri()) return 'preview';
  if (import.meta.env.DEV) return 'development';
  if (useServers.getState().localAvailable) return 'source-build';
  return 'supported';
}

export interface AvailableUpdate {
  version: string;
  notes: string | null;
  date: string | null;
  /** The oldest server the new version works with, when the feed says. */
  minServerVersion: string | null;
}

type Status = 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'restarting' | 'failed';

interface UpdatesState {
  status: Status;
  available: AvailableUpdate | null;
  /** Bytes received and expected while downloading; total is null when unknown. */
  progress: { received: number; total: number | null };
  error: string | null;
  checkedAt: number | null;
  autoCheck: boolean;
  /** The newest server release, looked up when an admin opens organization settings. */
  serverRelease: ServerRelease | null;

  /** `quiet` leaves the status untouched on failure, for background checks. */
  check: (options?: { quiet?: boolean }) => Promise<void>;
  install: () => Promise<void>;
  setAutoCheck: (on: boolean) => void;
  checkServerRelease: () => Promise<void>;
}

// The plugin's handle to a found update. Kept out of state: it is a native
// resource, not data to render.
let pending: Update | null = null;

function readAutoCheck(): boolean {
  try {
    return localStorage.getItem(AUTO_CHECK_KEY) !== 'off';
  } catch {
    return true;
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export const useUpdates = create<UpdatesState>((set, get) => ({
  status: 'idle',
  available: null,
  progress: { received: 0, total: null },
  error: null,
  checkedAt: null,
  autoCheck: readAutoCheck(),
  serverRelease: null,

  check: async ({ quiet = false } = {}) => {
    const { status } = get();
    if (updateSupport() !== 'supported' || status === 'downloading' || status === 'restarting') return;
    if (!quiet) set({ status: 'checking', error: null });
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      pending = update;
      const minServer = update?.rawJson.min_server_version;
      set({
        checkedAt: Date.now(),
        error: null,
        status: update ? 'available' : 'up-to-date',
        available: update
          ? {
              version: update.version,
              notes: update.body?.trim() || null,
              date: update.date ?? null,
              minServerVersion: typeof minServer === 'string' ? minServer : null,
            }
          : null,
      });
    } catch (err) {
      if (!quiet) set({ status: 'failed', error: message(err) });
    }
  },

  install: async () => {
    if (!pending) return;
    set({ status: 'downloading', progress: { received: 0, total: null }, error: null });
    try {
      await pending.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          set({ progress: { received: 0, total: event.data.contentLength ?? null } });
        } else if (event.event === 'Progress') {
          set((s) => ({ progress: { ...s.progress, received: s.progress.received + event.data.chunkLength } }));
        }
      });
      set({ status: 'restarting' });
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (err) {
      set({ status: 'failed', error: message(err) });
    }
  },

  setAutoCheck: (on) => {
    try {
      localStorage.setItem(AUTO_CHECK_KEY, on ? 'on' : 'off');
    } catch {
      // Preference only — it falls back to checking automatically.
    }
    set({ autoCheck: on });
    if (on) void get().check({ quiet: true });
  },

  checkServerRelease: async () => {
    try {
      set({ serverRelease: await fetchNewestServerRelease() });
    } catch {
      // Informational only; a failed lookup just shows no notice.
    }
  },
}));

let started = false;

/**
 * Look for an app update now and every few hours, while automatic checks are
 * on. Runs once per launch; failures stay silent until someone opens Settings
 * and asks.
 */
export function startUpdateChecks(): void {
  if (started || !inTauri()) return;
  started = true;
  const tick = () => {
    const { autoCheck, check } = useUpdates.getState();
    if (autoCheck) void check({ quiet: true });
  };
  tick();
  setInterval(tick, CHECK_INTERVAL_MS);
}
