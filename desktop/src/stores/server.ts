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

interface ServerState {
  servers: ServerProfile[];
  activeId: string | null;
  localAvailable: boolean;
  /** What the active server last told us about itself. Null until probed. */
  info: ServerInfo | null;
  /** Null while unknown; true once a probe succeeds, false once one fails. */
  reachable: boolean | null;
  loading: boolean;

  load: () => Promise<void>;
  connect: (url: string, name: string, lastEmail?: string) => Promise<void>;
  activate: (id: string) => Promise<void>;
  forget: (id: string) => Promise<void>;
  recheck: () => Promise<void>;
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

  load: async () => {
    try {
      const config = await invoke<ServerConfig>('servers_list');
      const active = applyActive(config);
      set({
        servers: config.servers,
        activeId: active?.id ?? null,
        localAvailable: config.local_available,
        loading: false,
      });
      if (active) void get().recheck();
    } catch {
      // A machine with no writable config directory still gets a usable app:
      // the connect screen appears and nothing is remembered between launches.
      set({ servers: [], activeId: null, loading: false });
    }
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
}));
