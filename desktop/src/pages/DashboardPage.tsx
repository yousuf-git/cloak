import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  KeyRound,
  ShieldCheck,
  FileLock2,
  LifeBuoy,
  FolderLock,
  KeySquare,
  TerminalSquare,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
} from 'lucide-react';
import { useCreds, useApiKeys, usePlatforms, useProjects, useAccessKeys, useSshKeys } from '@/hooks/vault';
import { useEnvFiles } from '@/hooks/useEnvFiles';
import { useAppMode } from '@/stores/app-mode';
import { useAuth } from '@/stores/auth';
import { useOrg } from '@/hooks/useOrg';
import { api, type ServiceStatusDto } from '@/lib/api';
import { crypto } from '@/lib/tauri-crypto';
import { firstName, timeAgo } from '@/lib/utils';

type PageId =
  | 'dashboard'
  | 'projects'
  | 'credentials'
  | 'env'
  | 'backup'
  | 'api-keys'
  | 'access-keys'
  | 'ssh-keys'
  | 'settings';

interface RecentItem {
  id: string;
  name: string;
  type: string;
  icon: typeof KeyRound;
  updatedAt: string;
  target: PageId;
}

export function DashboardPage({ onNavigate }: { onNavigate: (id: PageId) => void }) {
  const sandbox = useAppMode((s) => s.sandbox);
  const email = useAuth((s) => s.email);
  const name = useAuth((s) => s.name);
  const { org } = useOrg();
  const creds = useCreds();
  const apiKeys = useApiKeys();
  const envFiles = useEnvFiles();
  const platforms = usePlatforms();
  const projects = useProjects();
  const accessKeys = useAccessKeys();
  const sshKeys = useSshKeys();

  const [twoFactor, setTwoFactor] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  // Null until the first reply — the service rows stay hidden rather than
  // flashing a false "unreachable" while the request is still in flight.
  const [service, setService] = useState<ServiceStatusDto | null>(null);

  useEffect(() => {
    if (sandbox) return;
    api.me().then((me) => setTwoFactor(me.two_factor_enabled)).catch(() => setTwoFactor(false));
    crypto.rememberStatus().then(setRememberDevice).catch(() => setRememberDevice(false));
    // A failed status call is itself the answer: the backend is not reachable.
    api
      .status()
      .then(setService)
      .catch(() =>
        setService({
          api: { ok: false },
          db: { connected: false, name: null, cluster: null },
          email: null,
        }),
      );
  }, [sandbox]);

  const stats = [
    { label: 'Credentials', value: creds.items.length, icon: KeyRound, target: 'credentials' as PageId },
    { label: 'API Keys', value: apiKeys.items.length, icon: ShieldCheck, target: 'api-keys' as PageId },
    { label: '.env Files', value: envFiles.items.length, icon: FileLock2, target: 'env' as PageId },
    { label: 'Backup Codes', value: platforms.items.length, icon: LifeBuoy, target: 'backup' as PageId },
    // Projects is the container the rest live in, not another pile of secrets —
    // the tint marks it as a different kind of thing, not a bigger number.
    { label: 'Projects', value: projects.items.length, icon: FolderLock, target: 'projects' as PageId, featured: true },
  ];

  const totalSecrets =
    creds.items.length +
    apiKeys.items.length +
    envFiles.items.length +
    platforms.items.length +
    accessKeys.items.length +
    sshKeys.items.length;
  // First word only: a full name wraps the heading and drags the whole page down.
  const identity = sandbox
    ? 'Sandbox operator'
    : (firstName(name) ?? email?.split('@')[0] ?? 'Vault operator');
  const workspace = sandbox ? 'Local sandbox' : (org?.name ?? 'Private workspace');

  const recent = useMemo<RecentItem[]>(() => {
    const items: RecentItem[] = [
      ...creds.items.map((c) => ({ id: c._id, name: c.name, type: 'Credential', icon: KeyRound, updatedAt: c.updated_at, target: 'credentials' as PageId })),
      ...apiKeys.items.map((k) => ({ id: k._id, name: k.label, type: 'API Key', icon: ShieldCheck, updatedAt: k.updated_at, target: 'api-keys' as PageId })),
      ...envFiles.items.map((f) => ({ id: f._id, name: f.label, type: 'Env File', icon: FileLock2, updatedAt: f.updated_at, target: 'env' as PageId })),
      ...accessKeys.items.map((k) => ({ id: k._id, name: k.title, type: 'Access Key', icon: KeySquare, updatedAt: k.updated_at, target: 'access-keys' as PageId })),
      ...sshKeys.items.map((k) => ({ id: k._id, name: k.title, type: 'SSH Key', icon: TerminalSquare, updatedAt: k.updated_at, target: 'ssh-keys' as PageId })),
    ];
    return items.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, 5);
  }, [creds.items, apiKeys.items, envFiles.items, accessKeys.items, sshKeys.items]);

  return (
    <div className="relative flex h-full flex-col gap-4 overflow-y-auto pb-2">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="dashboard-hero relative grid overflow-hidden rounded-[var(--radius-xl)] border p-5 sm:grid-cols-[1fr_auto] sm:p-6"
      >
        <div className="relative z-10 flex min-w-0 flex-col justify-between gap-4">
          <div className="min-w-0">
            <p className="telemetry-label mb-2" style={{ color: 'var(--color-accent)' }}>
              Vault overview / {workspace}
            </p>
            {/* The greeting is the caption; the name is the heading. Keeping them
                at one size made the line wrap and stretched the header. */}
            <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>
              Welcome back,
            </p>
            <h1 className="font-display truncate text-3xl font-semibold leading-tight tracking-[-0.045em]">
              {identity}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-sm" style={{ color: 'var(--color-fg-muted)' }}>
              <span className="font-mono font-semibold" style={{ color: 'var(--color-text)' }}>{totalSecrets}</span>{' '}
              {totalSecrets === 1 ? 'encrypted item' : 'encrypted items'} across{' '}
              <span className="font-mono font-semibold" style={{ color: 'var(--color-text)' }}>{projects.items.length}</span>{' '}
              {projects.items.length === 1 ? 'project' : 'projects'}.
            </p>
            <span className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--color-fg-muted)' }}>
              <span className="status-dot h-2 w-2 shrink-0 rounded-full" />
              Encrypted / secure
            </span>
          </div>
        </div>

        <div className="pointer-events-none relative z-10 hidden items-center justify-end sm:flex">
          <VaultOrb />
        </div>
      </motion.header>

      <div className="relative grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s, i) => (
          <StatCard key={s.label} {...s} delay={i * 0.05} onClick={() => onNavigate(s.target)} />
        ))}
      </div>

      <div className="dashboard-wide-grid relative grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <RecentItemsCard items={recent} onNavigate={onNavigate} />
        <SecurityCard twoFactor={twoFactor} rememberDevice={rememberDevice} service={service} />
      </div>
    </div>
  );
}

/* Shared premium card chrome — hairline sheen at the top edge, soft depth. */
const cardStyle = {
  borderColor: 'var(--color-border-soft)',
  background: 'var(--gradient-panel)',
  boxShadow: 'var(--shadow-low)',
} as const;

function StatCard({
  label,
  value,
  icon: Icon,
  delay,
  featured = false,
  onClick,
}: {
  label: string;
  value: number;
  icon: typeof KeyRound;
  delay: number;
  featured?: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      className="dashboard-card no-drag group relative flex flex-col items-start justify-between gap-2 overflow-hidden rounded-[var(--radius-xl)] p-3.5 text-left"
      style={{
        borderColor: featured
          ? 'color-mix(in srgb, var(--color-accent) 45%, var(--color-border-soft))'
          : 'var(--color-border-soft)',
        background: featured
          ? 'linear-gradient(155deg, var(--color-accent-soft), var(--color-surface-1) 72%)'
          : 'var(--gradient-panel)',
        boxShadow: cardStyle.boxShadow,
      }}
    >
      {/* Hover glow — purple bloom bottom-right. */}
      <div
        className="pointer-events-none absolute -bottom-8 -right-8 h-24 w-24 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: 'radial-gradient(circle, var(--color-accent-soft), transparent 70%)' }}
        aria-hidden
      />

      {/* Value sits beside the icon rather than under it — the stacked layout
          cost a row of height the default window does not have to spare. */}
      <div className="flex w-full items-center gap-2.5">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
          style={{
            borderColor: 'var(--color-border-strong)',
            backgroundColor: featured ? 'var(--color-accent-soft)' : 'var(--color-surface-2)',
          }}
        >
          <Icon className="h-[17px] w-[17px]" style={{ color: featured ? 'var(--color-accent)' : 'var(--color-metal)' }} />
        </div>
        {/* Proportional figures: tabular-nums would leave a small count looking
            loose at this size, and nothing here has to align in a column. */}
        <p className="font-mono text-2xl font-semibold leading-none tracking-[-0.05em]">{value}</p>
        <ArrowUpRight
          className="ml-auto h-4 w-4 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
          style={{ color: 'var(--color-fg-muted)' }}
        />
      </div>

      <p className="telemetry-label">{label}</p>
    </motion.button>
  );
}

function RecentItemsCard({ items, onNavigate }: { items: RecentItem[]; onNavigate: (id: PageId) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.25 }}
      className="dashboard-card relative flex min-h-0 flex-col rounded-[var(--radius-xl)] p-5"
      style={cardStyle}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="telemetry-label block">Latest activity</span>
          <h2 className="mt-1 font-display text-lg font-semibold tracking-tight">Recently secured</h2>
        </div>
        {/* Sits in the header rather than at the card's foot, where the section's
            bottom rule clipped it. */}
        <button
          onClick={() => onNavigate('credentials')}
          className="no-drag flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
          style={{ color: 'var(--color-accent)' }}
        >
          View all items
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-8 text-center text-sm" style={{ color: 'var(--color-fg-muted)' }}>
          Nothing added yet — your recent activity will show up here.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={`${item.type}-${item.id}`}>
                <button
                  onClick={() => onNavigate(item.target)}
                  className="no-drag group flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors"
                    style={{
                      borderColor: 'var(--color-border-soft)',
                      backgroundColor: 'var(--color-surface-2)',
                    }}
                  >
                    <Icon className="h-4 w-4" style={{ color: 'var(--color-metal)' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                      {item.type}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums" style={{ color: 'var(--color-fg-muted)' }}>
                    {timeAgo(item.updatedAt)}
                  </span>
                  <ArrowRight
                    className="h-3.5 w-3.5 shrink-0 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                    style={{ color: 'var(--color-brand-400)' }}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </motion.div>
  );
}

/** Decorative shield with two tilted orbital rings — the header's vault mark. */
function VaultOrb() {
  return (
    <div className="orb-scene relative h-[132px] w-[132px] shrink-0" aria-hidden>
      <div className="orb-shadow" />
      <div className="orb-wrap orb-wrap-1">
        <div className="orb-ring">
          <div className="orb-node" />
        </div>
      </div>
      <div className="orb-wrap orb-wrap-2">
        <div className="orb-ring">
          <div className="orb-node" />
        </div>
      </div>
      <img
        src="/lock-asset-3d-keyed.png"
        alt=""
        className="orb-shield absolute inset-x-0 top-0 mx-auto h-[98px] w-auto object-contain"
        style={{
          filter: 'drop-shadow(0 8px 12px color-mix(in srgb, var(--color-canvas) 80%, transparent))',
        }}
      />
    </div>
  );
}

/**
 * Resend delivers verification codes, sign-in codes and invitations, so a
 * server without it cannot onboard anyone — an outage, not a preference.
 */
function emailCheck(email: ServiceStatusDto['email']) {
  if (!email) {
    return {
      ok: false,
      title: 'Email status unknown',
      hint: 'The backend did not answer',
      severity: 'danger' as const,
    };
  }
  return {
    ok: email.configured,
    title: email.configured ? 'Resend key configured' : 'Resend key missing',
    hint: email.configured
      ? `Email delivery · ${email.api_key_masked}`
      : 'Codes and invitations are only written to the server log',
    severity: 'danger' as const,
  };
}

function SecurityCard({
  twoFactor,
  rememberDevice,
  service,
}: {
  twoFactor: boolean;
  rememberDevice: boolean;
  service: ServiceStatusDto | null;
}) {
  // `severity` is how bad a failed check is. Settings the user can change are
  // a warning; a service that is down is an outage and reads as one.
  const checks: { ok: boolean; title: string; hint: string; severity: 'warning' | 'danger' }[] = [
    {
      ok: true,
      title: 'Zero-knowledge encryption',
      hint: 'All keys stored locally',
      severity: 'warning',
    },
    {
      ok: twoFactor,
      title: twoFactor ? '2FA is enabled' : '2FA is disabled',
      hint: twoFactor ? 'Email + OTP active' : 'Enable it in Settings for extra protection',
      severity: 'warning',
    },
    {
      ok: rememberDevice,
      title: rememberDevice ? 'Secure device' : 'Standard session',
      hint: rememberDevice ? 'Master key in OS keychain' : 'Sign in required each launch',
      severity: 'warning',
    },
    // Sandbox runs with no server behind it, so these would be meaningless.
    ...(service
      ? [
          {
            ok: service.api.ok,
            title: service.api.ok ? 'Backend online' : 'Backend unreachable',
            hint: service.api.ok ? 'Cloak API responding' : 'Cannot reach the Cloak API',
            severity: 'danger' as const,
          },
          {
            ok: service.db.connected,
            title: service.db.connected ? 'Database connected' : 'Database unavailable',
            hint: service.db.name
              ? [service.db.cluster, service.db.name].filter(Boolean).join(' · ')
              : 'No database connection',
            severity: 'danger' as const,
          },
          emailCheck(service.email),
        ]
      : []),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.3 }}
      className="dashboard-card relative flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-xl)] p-5"
      style={cardStyle}
    >
      {/* Same header shape as the card beside it. The icon sat centred against
          two lines of text, which read as misaligned next to that card. */}
      <div>
        <span className="telemetry-label block">Live safeguards</span>
        <h2 className="mt-1 font-display text-lg font-semibold tracking-tight">Security posture</h2>
      </div>

      <ul className="mt-4 flex flex-col gap-3.5">
        {checks.map((c) => (
          <li key={c.title} className="flex items-start gap-3">
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: `color-mix(in srgb, var(--color-${c.ok ? 'success' : c.severity}) 15%, transparent)`,
              }}
            >
              {c.ok ? (
                <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--color-success)' }} />
              ) : (
                <AlertCircle className="h-4 w-4" style={{ color: `var(--color-${c.severity})` }} />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{c.title}</p>
              <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                {c.hint}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
