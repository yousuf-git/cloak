import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { setApiBaseUrl } from '@/lib/api';
import { probeServer, type ServerInfo } from '@/lib/server';

export interface ServerProfile {
  id: string;
  url: string;
  name: string;
  last_email?: string;
}

interface ServerConfig {
  servers: ServerProfile[];
  active_id: string | null;
  /** True only in a build that bakes in CLOAK_API_DIR and can run its own API. */
  local_available: boolean;
}

/** The sidecar's fixed port. Must match `sidecar::API_PORT` in the Rust core. */
export const LOCAL_SERVER_URL = 'http://127.0.0.1:47821/api/v1';

/** Mirrors `sidecar::StartupError`. `stage` is set when the backend said what broke. */
export interface StartupError {
  stage: 'database' | 'deployment' | null;
  message: string;
}

/** Mirrors `sidecar::SidecarStatus`. */
export type SidecarStatus =
  | { state: 'disabled' }
  | {
      state: 'starting';
      attempt: number;
      max_attempts: number;
      last_error: StartupError | null;
      /** The backend's own database retries, once it has started retrying. */
      database: { attempt: number; max_attempts: number } | null;
    }
  | { state: 'ready' }
  | { state: 'failed'; error: StartupError; log_dir: string | null };

const SIDECAR_POLL_MS = 750;

/**
 * How long the splash waits for the local backend before showing the sign-in
 * screen with its progress instead. Covers a normal start (about 5s), so a
 * remembered session opens straight into the vault.
 */
const STARTUP_GRACE_MS = 10_000;

let watchingSidecar = false;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface ServerState {
  servers: ServerProfile[];
  activeId: string | null;
  localAvailable: boolean;
  /** What the active server last told us about itself. Null until probed. */
  info: ServerInfo | null;
  /** Null while unknown; true once a probe succeeds, false once one fails. */
  reachable: boolean | null;
  loading: boolean;
  /** This build's own backend, when it has one. Null until first read. */
  sidecar: SidecarStatus | null;

  load: () => Promise<void>;
  connect: (url: string, name: string, lastEmail?: string) => Promise<void>;
  activate: (id: string) => Promise<void>;
  forget: (id: string) => Promise<void>;
  recheck: () => Promise<void>;
  /** Try the active server again — restarting the local backend if it gave up. */
  retry: () => Promise<void>;
  /** Follow the local backend's startup until it settles, then probe it. */
  watchSidecar: () => Promise<void>;
}

function applyActive(config: ServerConfig): ServerProfile | null {
  const active =
    config.servers.find((s) => s.id === config.active_id) ?? config.servers[0] ?? null;
  if (active) setApiBaseUrl(active.url);
  return active;
}

export const useServers = create<ServerState>((set, get) => ({
  servers: [],
  activeId: null,
  localAvailable: false,
  info: null,
  reachable: null,
  loading: true,
  sidecar: null,

  load: async () => {
    let config: ServerConfig;
    try {
      config = await invoke<ServerConfig>('servers_list');
    } catch {
      // A machine with no writable config directory still gets a usable app:
      // the connect screen appears and nothing is remembered between launches.
      return set({ servers: [], activeId: null, loading: false });
    }

    const active = applyActive(config);
    set({
      servers: config.servers,
      activeId: active?.id ?? null,
      localAvailable: config.local_available,
    });

    if (config.local_available) {
      const settled = get().watchSidecar();
      if (!active || active.url === LOCAL_SERVER_URL) {
        await Promise.race([settled, sleep(STARTUP_GRACE_MS)]);
      }
    }

    if (active) {
      void get().recheck();
    } else if (config.local_available) {
      // A `pnpm ship` build runs its own backend, so with nothing saved yet that
      // is the server it means. Adopted even if it is still starting: the
      // sign-in screen shows that progress, and a retry once it gives up.
      await get().connect(LOCAL_SERVER_URL, 'This computer');
    }
    set({ loading: false });
  },

  connect: async (url, name, lastEmail) => {
    let config: ServerConfig;
    try {
      config = await invoke<ServerConfig>('servers_save', {
        url,
        name,
        lastEmail: lastEmail ?? null,
      });
    } catch {
      // Could not persist — a read-only or missing config directory. Carry the
      // choice in memory so this session still works, and let the next launch
      // ask again rather than refusing to connect at all.
      const existing = get().servers.find((s) => s.url === url);
      const profile = existing ?? { id: `memory-${Date.now()}`, url, name, last_email: lastEmail };
      config = {
        servers: existing ? get().servers : [...get().servers, profile],
        active_id: profile.id,
        local_available: get().localAvailable,
      };
    }
    const active = applyActive(config);
    set({ servers: config.servers, activeId: active?.id ?? null });
    await get().recheck();
  },

  activate: async (id) => {
    const config = await invoke<ServerConfig>('servers_activate', { id });
    const active = applyActive(config);
    set({ servers: config.servers, activeId: active?.id ?? null, info: null, reachable: null });
    await get().recheck();
  },

  forget: async (id) => {
    const config = await invoke<ServerConfig>('servers_forget', { id });
    const active = applyActive(config);
    set({ servers: config.servers, activeId: active?.id ?? null, info: null, reachable: null });
    if (active) await get().recheck();
  },

  recheck: async () => {
    const { servers, activeId } = get();
    const active = servers.find((s) => s.id === activeId);
    if (!active) return set({ info: null, reachable: null });

    const result = await probeServer(active.url);
    set(result.ok ? { info: result.info, reachable: true } : { info: null, reachable: false });
  },

  retry: async () => {
    const { servers, activeId, sidecar } = get();
    const active = servers.find((s) => s.id === activeId);
    if (active?.url === LOCAL_SERVER_URL && sidecar?.state === 'failed') {
      set({ sidecar: await invoke<SidecarStatus>('sidecar_retry') });
      await get().watchSidecar();
      return;
    }
    await get().recheck();
  },

  watchSidecar: async () => {
    if (watchingSidecar) return;
    watchingSidecar = true;
    try {
      for (;;) {
        let status: SidecarStatus;
        try {
          status = await invoke<SidecarStatus>('sidecar_status');
        } catch {
          return;
        }
        set({ sidecar: status });
        if (status.state === 'ready') return await get().recheck();
        if (status.state !== 'starting') return;
        await sleep(SIDECAR_POLL_MS);
      }
    } finally {
      watchingSidecar = false;
    }
  },
}));
