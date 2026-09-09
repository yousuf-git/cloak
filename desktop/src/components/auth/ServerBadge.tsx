import { Server, ChevronRight } from 'lucide-react';
import { useServers } from '@/stores/server';

/**
 * Names the server the credentials on screen are about to be sent to.
 *
 * On a self-hosted product two different companies' sign-in screens are
 * identical, and an account created against the wrong one silently belongs to
 * the wrong organization. Showing the destination is cheaper than explaining
 * that afterwards.
 */
export function ServerBadge({ name }: { name?: string }) {
  const servers = useServers((s) => s.servers);
  const activeId = useServers((s) => s.activeId);
  const active = servers.find((s) => s.id === activeId);
  if (!active) return null;

  const host = hostOf(active.url);

  return (
    <button
      onClick={() => useServers.setState({ activeId: null })}
      className="no-drag mt-4 flex w-full items-center justify-between gap-3 rounded-[var(--radius-lg)] border px-3.5 py-2.5 text-left transition-colors"
      style={{ borderColor: 'var(--color-border-soft)', backgroundColor: 'var(--color-surface-2)' }}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <Server className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--color-accent)' }} />
        <span className="min-w-0">
          <span className="block truncate text-xs font-medium">{name ?? active.name}</span>
          <span
            className="block truncate text-[11px] tabular-nums"
            style={{ color: 'var(--color-fg-muted)', fontFamily: 'var(--font-mono)' }}
          >
            {host}
          </span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-[11px]" style={{ color: 'var(--color-fg-muted)' }}>
        Change
        <ChevronRight className="h-3 w-3" />
      </span>
    </button>
  );
}

function hostOf(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
  } catch {
    return url;
  }
}
