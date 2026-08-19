import { useEffect, useMemo, useRef, useState } from 'react';
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
} from 'lucide-react';
import { useCreds, useApiKeys, usePlatforms, useProjects, useAccessKeys, useSshKeys } from '@/hooks/vault';
import { useEnvFiles } from '@/hooks/useEnvFiles';
import { useAppMode } from '@/stores/app-mode';
import { api } from '@/lib/api';
import { crypto } from '@/lib/tauri-crypto';
import { timeAgo } from '@/lib/utils';

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
  const creds = useCreds();
  const apiKeys = useApiKeys();
  const envFiles = useEnvFiles();
  const platforms = usePlatforms();
  const projects = useProjects();
  const accessKeys = useAccessKeys();
  const sshKeys = useSshKeys();

  const [twoFactor, setTwoFactor] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);

  useEffect(() => {
    if (sandbox) return;
    api.me().then((me) => setTwoFactor(me.two_factor_enabled)).catch(() => setTwoFactor(false));
    crypto.rememberStatus().then(setRememberDevice).catch(() => setRememberDevice(false));
  }, [sandbox]);

  const stats = [
    { label: 'Credentials', value: creds.items.length, icon: KeyRound, target: 'credentials' as PageId },
    { label: 'API Keys', value: apiKeys.items.length, icon: ShieldCheck, target: 'api-keys' as PageId },
    { label: '.env Files', value: envFiles.items.length, icon: FileLock2, target: 'env' as PageId },
    { label: 'Backup Codes', value: platforms.items.length, icon: LifeBuoy, target: 'backup' as PageId },
    { label: 'Projects', value: projects.items.length, icon: FolderLock, target: 'projects' as PageId },
  ];

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
    <div className="flex h-full flex-col gap-5 overflow-y-auto pb-1">
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-fg-muted)' }}>
          Your vault is locked and secure.
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s, i) => (
          <StatCard key={s.label} {...s} delay={i * 0.04} onClick={() => onNavigate(s.target)} />
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
        <RecentItemsCard items={recent} onNavigate={onNavigate} />
        <SecurityCard twoFactor={twoFactor} rememberDevice={rememberDevice} />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  delay,
  onClick,
}: {
  label: string;
  value: number;
  icon: typeof KeyRound;
  delay: number;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className="no-drag flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ backgroundColor: 'color-mix(in srgb, var(--color-brand-500) 14%, transparent)' }}
      >
        <Icon className="h-4 w-4" style={{ color: 'var(--color-brand-400)' }} />
      </div>
      <div>
        <p className="font-display text-2xl font-semibold leading-none">{value}</p>
        <p className="mt-1.5 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
          {label}
        </p>
      </div>
    </motion.button>
  );
}

function RecentItemsCard({ items, onNavigate }: { items: RecentItem[]; onNavigate: (id: PageId) => void }) {
  return (
    <div
      className="flex min-h-0 flex-col rounded-xl border p-4"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <h2 className="text-sm font-semibold">Recent Items</h2>

      {items.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-8 text-center text-sm" style={{ color: 'var(--color-fg-muted)' }}>
          Nothing added yet — your recent activity will show up here.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={`${item.type}-${item.id}`}>
                <button
                  onClick={() => onNavigate(item.target)}
                  className="no-drag flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: 'var(--color-surface-2)' }}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color: 'var(--color-brand-400)' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                      {item.type}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                    {timeAgo(item.updatedAt)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        onClick={() => onNavigate('credentials')}
        className="no-drag mt-2 flex items-center gap-1 self-start px-2 py-1 text-xs font-medium transition-opacity hover:opacity-80"
        style={{ color: 'var(--color-brand-400)' }}
      >
        View all items
        <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
}

const ORB_MIN = 110;
const ORB_MAX = 340;

function SecurityCard({ twoFactor, rememberDevice }: { twoFactor: boolean; rememberDevice: boolean }) {
  // Measures the dedicated zone below the checklist (not the whole card) so
  // the shield's size tracks actual leftover space instead of being thrown
  // off by how tall the checklist itself happens to be.
  const zoneRef = useRef<HTMLDivElement>(null);
  const [orbSize, setOrbSize] = useState(ORB_MIN);

  useEffect(() => {
    const el = zoneRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      const fit = Math.min(width, height) * 0.92;
      setOrbSize(Math.min(ORB_MAX, Math.max(ORB_MIN, fit)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const checks = [
    {
      ok: true,
      title: 'Zero-knowledge encryption',
      hint: 'All keys stored locally',
    },
    {
      ok: twoFactor,
      title: twoFactor ? '2FA is enabled' : '2FA is disabled',
      hint: twoFactor ? 'Email + OTP active' : 'Enable it in Settings for extra protection',
    },
    {
      ok: true,
      title: 'Recovery key set',
      hint: 'You can recover your account',
    },
    {
      ok: rememberDevice,
      title: rememberDevice ? 'Secure device' : 'Standard session',
      hint: rememberDevice ? 'Master key in OS keychain' : 'Sign in required each launch',
    },
  ];

  return (
    <div
      className="relative flex min-h-0 flex-col overflow-hidden rounded-xl border p-4"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <h2 className="text-sm font-semibold">Security at a glance</h2>

      <ul className="mt-3 flex flex-col gap-3">
        {checks.map((c) => (
          <li key={c.title} className="flex items-start gap-2.5">
            {c.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#22c55e' }} />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#f59e0b' }} />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium">{c.title}</p>
              <p className="text-xs" style={{ color: 'var(--color-fg-muted)' }}>
                {c.hint}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {/* Leftover space below the checklist — the shield is sized off this
          zone's own box (ResizeObserver above), not the whole card, so the
          checklist's height never throws off how big the shield gets. */}
      <div ref={zoneRef} className="relative mt-3 min-h-28 flex-1">
        {/* Elevated shield with two tilted 3D orbital rings — purely decorative. */}
        <div
          className="orb-scene pointer-events-none absolute bottom-0 right-0"
          style={{ width: orbSize, height: orbSize }}
          aria-hidden
        >
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
            className="orb-shield absolute inset-x-0 top-0 mx-auto w-auto object-contain"
            style={{
              height: orbSize * 0.74,
              filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.35))',
            }}
          />
        </div>
      </div>
    </div>
  );
}
