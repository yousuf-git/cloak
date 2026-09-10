import { useState } from 'react';
import { AlertTriangle, ChevronRight, Loader2, RotateCw, Server } from 'lucide-react';
import { hostOf } from '@/lib/api';
import { LOCAL_SERVER_URL, useServers, type SidecarStatus } from '@/stores/server';

/**
 * Names the server the credentials on screen are about to be sent to.
 *
 * On a self-hosted product two different companies' sign-in screens are
 * identical, and an account created against the wrong one silently belongs to
 * the wrong organization. Showing the destination is cheaper than explaining
 * that afterwards.
 *
 * It is also where a server that cannot be reached says so, and why — the
 * sign-in form alone could only report that a request failed.
 */
export function ServerBadge({ name }: { name?: string }) {
  const servers = useServers((s) => s.servers);
  const activeId = useServers((s) => s.activeId);
  const reachable = useServers((s) => s.reachable);
  const sidecar = useServers((s) => s.sidecar);
  const retry = useServers((s) => s.retry);
  const [retrying, setRetrying] = useState(false);

  const active = servers.find((s) => s.id === activeId);
  if (!active) return null;

  const problem = describeProblem(active.url === LOCAL_SERVER_URL ? sidecar : null, reachable);

  const onRetry = async () => {
    setRetrying(true);
    try {
      await retry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      className="mt-4 overflow-hidden rounded-[var(--radius-lg)] border"
      style={{
        borderColor: problem?.tone === 'error'
          ? 'color-mix(in srgb, var(--color-danger) 40%, var(--color-border-soft))'
          : 'var(--color-border-soft)',
        backgroundColor: 'var(--color-surface-2)',
      }}
    >
      <button
        onClick={() => useServers.setState({ activeId: null })}
        className="no-drag flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <Server className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-accent)' }} />
          <span className="min-w-0">
            <span className="block truncate text-xs font-medium">{name ?? active.name}</span>
            <span
              className="block truncate text-[11px] tabular-nums"
              style={{ color: 'var(--color-fg-muted)', fontFamily: 'var(--font-mono)' }}
            >
              {hostOf(active.url)}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[11px]" style={{ color: 'var(--color-fg-muted)' }}>
          Change
          <ChevronRight className="h-3 w-3" />
        </span>
      </button>

      {problem && (
        <div
          role="status"
          className="flex items-start gap-2.5 border-t px-3.5 py-2.5"
          style={{ borderColor: 'var(--color-border-soft)' }}
        >
          {problem.tone === 'busy' ? (
            <Loader2
              className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin"
              style={{ color: 'var(--color-accent)' }}
            />
          ) : (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-danger)' }} />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium">{problem.title}</p>
            {problem.detail && (
              <p
                data-selectable="true"
                className="mt-0.5 break-words text-[11px] leading-4"
                style={{ color: 'var(--color-fg-muted)' }}
              >
                {problem.detail}
              </p>
            )}
          </div>
          {problem.canRetry && (
            <button
              onClick={() => void onRetry()}
              disabled={retrying}
              className="no-drag flex shrink-0 items-center gap-1 rounded-[var(--radius-md)] border px-2 py-1 text-[11px] font-medium disabled:opacity-60"
              style={{ borderColor: 'var(--color-border-soft)' }}
            >
              <RotateCw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface Problem {
  tone: 'busy' | 'error';
  title: string;
  detail?: string;
  canRetry: boolean;
}

/** Backend messages arrive with and without a closing full stop. */
function sentence(message: string): string {
  return /[.!?]$/.test(message) ? message : `${message}.`;
}

const DATABASE_HINT =
  'Check your network, MONGODB_URI in api/.env, and that this machine is on the database’s IP allowlist.';

/**
 * What is wrong with the active server, if anything. `sidecar` is passed only
 * when the active server is this machine's own backend, whose startup the app
 * can see into; any other server is simply reachable or not.
 */
function describeProblem(sidecar: SidecarStatus | null, reachable: boolean | null): Problem | null {
  if (sidecar?.state === 'starting') {
    const { database, last_error: error } = sidecar;
    if (database) {
      return {
        tone: 'busy',
        title: `Can’t reach the database — retrying (${database.attempt} of ${database.max_attempts})`,
        detail: error?.message,
        canRetry: false,
      };
    }
    if (sidecar.attempt > 1) {
      return {
        tone: 'busy',
        title: `The local server stopped — restarting (${sidecar.attempt} of ${sidecar.max_attempts})`,
        detail: error?.message,
        canRetry: false,
      };
    }
    return { tone: 'busy', title: 'Starting the local server…', canRetry: false };
  }

  if (sidecar?.state === 'failed') {
    const { error, log_dir } = sidecar;
    const log = log_dir ? ` Full details are in ${log_dir}/Cloak.log.` : '';
    if (error.stage === 'database') {
      return {
        tone: 'error',
        title: 'The local server didn’t start: it can’t reach its database',
        detail: `${sentence(error.message)} ${DATABASE_HINT}`,
        canRetry: true,
      };
    }
    return {
      tone: 'error',
      title: 'The local server didn’t start',
      detail: `${sentence(error.message)}${log}`,
      canRetry: true,
    };
  }

  if (reachable === false) {
    return {
      tone: 'error',
      title: 'Can’t reach this server',
      detail: 'It may be down, or the network between here and there is.',
      canRetry: true,
    };
  }
  return null;
}
